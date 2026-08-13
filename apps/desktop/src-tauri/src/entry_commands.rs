//! 사이드바 파일 조작 커맨드. 계약: .claude/docs/rust-commands.md.

use std::fs;
use std::path::{Path, PathBuf};

use tauri::State;

use crate::error::AppError;
use crate::scope::FileScope;

#[tauri::command]
#[specta::specta]
pub async fn create_file(
    scope: State<'_, FileScope>,
    dir: String,
    name: String,
) -> Result<String, AppError> {
    create_file_impl(&scope, &dir, &name)
}

#[tauri::command]
#[specta::specta]
pub async fn create_dir(
    scope: State<'_, FileScope>,
    dir: String,
    name: String,
) -> Result<String, AppError> {
    create_dir_impl(&scope, &dir, &name)
}

#[tauri::command]
#[specta::specta]
pub async fn rename_entry(
    scope: State<'_, FileScope>,
    path: String,
    new_name: String,
) -> Result<String, AppError> {
    rename_entry_impl(&scope, &path, &new_name)
}

#[tauri::command]
#[specta::specta]
pub async fn delete_entry(scope: State<'_, FileScope>, path: String) -> Result<(), AppError> {
    delete_entry_impl(&scope, &path)
}

pub fn rename_entry_impl(
    scope: &FileScope,
    path: &str,
    new_name: &str,
) -> Result<String, AppError> {
    let source = resolve_entry(scope, path)?;
    let parent = source
        .parent()
        .ok_or_else(|| AppError::Io("부모 디렉터리가 없습니다".into()))?;
    let name = validate_name(new_name)?;
    let name = if source.is_dir() {
        name
    } else {
        with_markdown_extension(name)
    };
    let target = parent.join(&name);
    if fs::symlink_metadata(&target).is_ok() && !is_same_entry(&source, &target) {
        return Err(AppError::AlreadyExists(name));
    }
    fs::rename(&source, &target)?;
    Ok(path_string(&target))
}

pub fn delete_entry_impl(scope: &FileScope, path: &str) -> Result<(), AppError> {
    let entry = resolve_entry(scope, path)?;
    trash_context()
        .delete(&entry)
        .map_err(|_| AppError::Io("휴지통으로 보내지 못했습니다".into()))
}

/// 삭제 방식(→ rust-commands.md#항목-조작).
#[cfg(target_os = "macos")]
fn trash_context() -> trash::TrashContext {
    use trash::macos::{DeleteMethod, TrashContextExtMacos};

    let mut context = trash::TrashContext::default();
    context.set_delete_method(DeleteMethod::NsFileManager);
    context
}

#[cfg(not(target_os = "macos"))]
fn trash_context() -> trash::TrashContext {
    trash::TrashContext::default()
}

fn is_same_entry(one: &Path, other: &Path) -> bool {
    use std::os::unix::fs::MetadataExt;
    match (fs::symlink_metadata(one), fs::symlink_metadata(other)) {
        (Ok(one), Ok(other)) => one.dev() == other.dev() && one.ino() == other.ino(),
        _ => false,
    }
}

pub fn create_file_impl(scope: &FileScope, dir: &str, name: &str) -> Result<String, AppError> {
    let parent = resolve_dir(scope, dir)?;
    let file_name = with_markdown_extension(validate_name(name)?);
    let path = parent.join(&file_name);
    match fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&path)
    {
        Ok(_) => Ok(path_string(&path)),
        Err(err) if err.kind() == std::io::ErrorKind::AlreadyExists => {
            Err(AppError::AlreadyExists(file_name))
        }
        Err(err) => Err(err.into()),
    }
}

pub fn create_dir_impl(scope: &FileScope, dir: &str, name: &str) -> Result<String, AppError> {
    let parent = resolve_dir(scope, dir)?;
    let dir_name = validate_name(name)?;
    let path = parent.join(&dir_name);
    match fs::create_dir(&path) {
        Ok(()) => Ok(path_string(&path)),
        Err(err) if err.kind() == std::io::ErrorKind::AlreadyExists => {
            Err(AppError::AlreadyExists(dir_name))
        }
        Err(err) => Err(err.into()),
    }
}

fn resolve_entry(scope: &FileScope, path: &str) -> Result<PathBuf, AppError> {
    let raw = Path::new(path);
    let (Some(parent), Some(name)) = (raw.parent(), raw.file_name()) else {
        return Err(AppError::Io("항목 경로가 아닙니다".into()));
    };
    let entry = fs::canonicalize(parent)?.join(name);
    scope.ensure_allowed(&entry)?;
    fs::symlink_metadata(&entry)?;
    Ok(entry)
}

/// 스코프 검증(→ rust-commands.md#권한-capabilities).
fn resolve_dir(scope: &FileScope, dir: &str) -> Result<PathBuf, AppError> {
    let canonical = fs::canonicalize(dir)?;
    scope.ensure_allowed(&canonical)?;
    if !canonical.is_dir() {
        return Err(AppError::Io("디렉터리가 아닙니다".into()));
    }
    Ok(canonical)
}

/// 항목 이름 규칙(→ rust-commands.md#항목-이름-규칙).
fn validate_name(name: &str) -> Result<String, AppError> {
    let trimmed = name.trim();
    let broken = trimmed.is_empty()
        || trimmed.starts_with('.')
        || trimmed.contains('/')
        || trimmed.chars().any(char::is_control);
    if broken {
        return Err(AppError::InvalidName(
            "이름은 비울 수 없고 '.'으로 시작하거나 '/'를 포함할 수 없습니다".into(),
        ));
    }
    Ok(trimmed.to_owned())
}

/// 확장자 수렴(→ rust-commands.md#항목-이름-규칙).
fn with_markdown_extension(name: String) -> String {
    let is_markdown = Path::new(&name)
        .extension()
        .is_some_and(|ext| ext.eq_ignore_ascii_case("md") || ext.eq_ignore_ascii_case("markdown"));
    if is_markdown {
        name
    } else {
        format!("{name}.md")
    }
}

fn path_string(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scoped_tempdir() -> (tempfile::TempDir, FileScope, PathBuf) {
        let dir = tempfile::tempdir().expect("임시 디렉터리 생성");
        let canonical = fs::canonicalize(dir.path()).expect("canonicalize");
        let scope = FileScope::default();
        scope.allow(canonical.clone());
        (dir, scope, canonical)
    }

    // 집행: rust-commands.md create_file — "빈 마크다운 파일을 만들고 만들어진 파일의
    //       canonical 경로를 반환한다"·§항목 이름 규칙의 트림과 .md 확장자 수렴.
    // 왜: 반환 경로가 canonical이어야 프론트가 그대로 탭을 열 수 있고(open_file과 같은 신원),
    //     .md로 수렴하지 않으면 트리 필터에 걸려 방금 만든 파일이 보이지 않는다.
    // 보장: 확장자 없는 이름에는 .md가 붙고, 이미 .md/.markdown인 이름(대소문자 무관)은
    //       그대로 쓰이며, 마크다운이 아닌 꼬리(v1.2)는 확장자로 치지 않아 .md가 붙는다.
    //       앞뒤 공백은 이름에 남지 않고 내용은 빈 문자열이다.
    // 경계: 중복·이름 위반은 아래 테스트가 다룬다.
    #[test]
    fn 새_파일은_md로_수렴하고_canonical_경로를_반환한다() {
        let (_dir, scope, canonical) = scoped_tempdir();
        let root = canonical.to_str().unwrap();

        let created = create_file_impl(&scope, root, "  회의  ").unwrap();

        assert_eq!(created, canonical.join("회의.md").to_str().unwrap());
        assert_eq!(fs::read_to_string(&created).unwrap(), "");
        assert!(create_file_impl(&scope, root, "노트.MD")
            .unwrap()
            .ends_with("노트.MD"));
        assert!(create_file_impl(&scope, root, "긴글.markdown")
            .unwrap()
            .ends_with("긴글.markdown"));
        assert!(create_file_impl(&scope, root, "v1.2")
            .unwrap()
            .ends_with("v1.2.md"));
    }

    // 집행: rust-commands.md create_file — "같은 이름이 이미 있으면 AppError::AlreadyExists".
    // 왜: 생성이 덮어쓰기가 되면 사용자가 쓰던 문서가 소리 없이 사라진다 — 데이터 유실 직결.
    // 보장: 두 번째 생성이 거부되고 첫 파일의 내용이 그대로 남는다. 확장자 수렴 뒤에
    //       같아지는 이름(회의 → 회의.md)도 같은 이름으로 걸린다.
    // 경계: 존재 확인과 생성 사이의 경합(create_new의 원자성)은 단위 테스트로 재현할 수
    //       없다 — 덮어쓰지 않는다는 결과만 고정한다.
    #[test]
    fn 같은_이름은_덮어쓰지_않고_거부한다() {
        let (_dir, scope, canonical) = scoped_tempdir();
        let root = canonical.to_str().unwrap();
        let created = create_file_impl(&scope, root, "회의").unwrap();
        fs::write(&created, "기존 내용").unwrap();

        assert!(matches!(
            create_file_impl(&scope, root, "회의"),
            Err(AppError::AlreadyExists(_))
        ));
        assert!(matches!(
            create_file_impl(&scope, root, "회의.md"),
            Err(AppError::AlreadyExists(_))
        ));
        assert_eq!(fs::read_to_string(&created).unwrap(), "기존 내용");
    }

    // 집행: rust-commands.md#항목-이름-규칙 — 빈 이름·'/'·제어문자·'.' 시작을 거부한다.
    // 왜: 이름은 경로가 아니다 — '/'를 허용하면 이름 입력만으로 다른 폴더에 손댈 수 있고,
    //     '.'으로 시작하는 항목은 트리가 표시하지 않아 만들자마자 사라진다.
    // 보장: 네 위반 모두 InvalidName으로 거부되고 파일시스템에 아무것도 남지 않는다.
    // 경계: 프론트도 같은 규칙을 입력 중에 판정하지만, 거부의 강제는 여기다(계약 문구).
    #[test]
    fn 이름_규칙_위반은_거부한다() {
        let (_dir, scope, canonical) = scoped_tempdir();
        let root = canonical.to_str().unwrap();

        for name in ["", "   ", ".숨김", "하위/회의", "제어\u{0}문자"] {
            assert!(
                matches!(
                    create_file_impl(&scope, root, name),
                    Err(AppError::InvalidName(_))
                ),
                "'{name}'이 거부되지 않았다"
            );
        }
        assert!(fs::read_dir(&canonical).unwrap().next().is_none());
    }

    // 집행: rust-commands.md create_dir — "규칙은 create_file과 같고 확장자 수렴만 없다".
    // 왜: 폴더에 .md가 붙으면 마크다운 파일처럼 보이는 폴더가 생긴다.
    // 보장: 이름 그대로 폴더가 만들어지고, 중복은 파일과 같이 AlreadyExists로 거부된다.
    // 경계: 이름 규칙은 create_file과 공유하므로 위 테스트가 대표한다.
    #[test]
    fn 새_폴더는_확장자를_붙이지_않는다() {
        let (_dir, scope, canonical) = scoped_tempdir();
        let root = canonical.to_str().unwrap();

        let created = create_dir_impl(&scope, root, "회의록").unwrap();

        assert_eq!(created, canonical.join("회의록").to_str().unwrap());
        assert!(Path::new(&created).is_dir());
        assert!(matches!(
            create_dir_impl(&scope, root, "회의록"),
            Err(AppError::AlreadyExists(_))
        ));
    }

    // 집행: rust-commands.md rename_entry — "같은 부모 안에서 이름만 바꾼다"·"파일이면
    //       확장자를 .md로 수렴하고, 디렉터리면 이름 그대로다".
    // 왜: 이름 변경으로 파일이 다른 폴더로 새면 사용자가 문서를 잃어버린 것처럼 느끼고,
    //     확장자가 빠지면 트리 필터에 걸려 바꾼 파일이 목록에서 사라진다.
    // 보장: 새 이름은 같은 부모 아래에 놓이고, 파일은 .md로 수렴하며 내용이 보존된다.
    //       폴더 이름에는 확장자가 붙지 않고 옛 경로는 사라진다.
    // 경계: 다른 폴더로 옮기는 이동은 이 커맨드의 일이 아니다 — 이름의 '/' 금지가 막는다.
    #[test]
    fn 이름을_바꾸면_같은_부모에_남고_파일은_md로_수렴한다() {
        let (_dir, scope, canonical) = scoped_tempdir();
        let file = create_file_impl(&scope, canonical.to_str().unwrap(), "회의").unwrap();
        fs::write(&file, "본문").unwrap();
        let folder = create_dir_impl(&scope, canonical.to_str().unwrap(), "묶음").unwrap();

        let renamed = rename_entry_impl(&scope, &file, "결산").unwrap();

        assert_eq!(renamed, canonical.join("결산.md").to_str().unwrap());
        assert_eq!(fs::read_to_string(&renamed).unwrap(), "본문");
        assert!(!Path::new(&file).exists());
        assert_eq!(
            rename_entry_impl(&scope, &folder, "보관").unwrap(),
            canonical.join("보관").to_str().unwrap()
        );
    }

    // 집행: rust-commands.md rename_entry — "대상 이름이 이미 있으면 AlreadyExists"·"단
    //       대소문자만 바꾸는 이름변경은 허용한다 … 같은 항목인지는 inode로 판정한다".
    // 왜: rename은 대상을 조용히 덮어쓴다 — 막지 않으면 이름 변경 한 번에 다른 문서가
    //     사라진다. 반대로 대소문자 교정까지 막으면 APFS에서 그 교정을 영영 할 수 없다
    //     (해소한 경로를 비교하면 자기 자신이 남으로 보인다).
    // 보장: 남의 이름과 겹치면 거부되고 두 파일 모두 그대로 남는다. 자기 이름의 대소문자만
    //       바꾸는 것은 통과한다.
    // 경계: 대소문자를 구분하는 파일시스템에서는 애초에 겹치지 않아 같은 결과가 된다.
    #[test]
    fn 남의_이름과_겹치면_거부하고_대소문자_교정은_허용한다() {
        let (_dir, scope, canonical) = scoped_tempdir();
        let root = canonical.to_str().unwrap();
        let file = create_file_impl(&scope, root, "회의").unwrap();
        fs::write(&file, "본문").unwrap();
        let other = create_file_impl(&scope, root, "결산").unwrap();

        assert!(matches!(
            rename_entry_impl(&scope, &file, "결산"),
            Err(AppError::AlreadyExists(_))
        ));
        assert_eq!(fs::read_to_string(&file).unwrap(), "본문");
        assert!(Path::new(&other).exists());

        let corrected = rename_entry_impl(&scope, &file, "회의.MD").unwrap();
        assert!(corrected.ends_with("회의.MD"));
        assert_eq!(fs::read_to_string(&corrected).unwrap(), "본문");
    }

    // 집행: rust-commands.md — "스코프 검증은 넷 다 부모 디렉터리를 canonicalize해서 한다 …
    //       심볼릭 링크를 만나면 링크 자체를 다룬다(대상이 아니라)".
    // 왜: 링크를 지웠는데 링크가 가리키던 원본이 사라지면, 트리에서 한 줄을 지운 대가로
    //     다른 곳의 문서를 잃는다 — 되돌릴 수 있어도 사용자가 의도한 일이 아니다.
    // 보장: 링크 자신이 휴지통에 나타나고 자리에서 사라지며, 링크의 대상은 그대로 남는다.
    //       허용 루트 밖과 없는 경로는 휴지통에 닿기 전에 거부된다.
    // 경계: 휴지통에 들어간 뒤의 복원("Put Back")은 OS의 일이라 다루지 않는다. 옮긴 항목을
    //       치우지 못해 남는 것은 testing.md#테스트가-휴지통에-남기는-것이 소유한다.
    #[test]
    fn 삭제는_링크_자체를_휴지통으로_보내고_스코프_밖은_거부한다() {
        let (_dir, scope, canonical) = scoped_tempdir();
        let target = canonical.join("원본.md");
        // 이름이 겹치면 휴지통이 개명해 넣고, 이 단언은 옛 실행이 남긴 동명 항목을 보고
        // 통과한다(휴지통은 나열이 막혀 개명된 이름을 찾을 수 없다). 프로세스 번호는
        // 재사용되므로 나노초를 더한다.
        let name = format!(
            "norii-테스트-{}-{}.md",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("UNIX_EPOCH 이후")
                .as_nanos()
        );
        let link = canonical.join(&name);
        fs::write(&target, "본문").unwrap();
        std::os::unix::fs::symlink(&target, &link).unwrap();

        delete_entry_impl(&scope, link.to_str().unwrap()).unwrap();

        assert_eq!(fs::read_link(trash_path(&name)).unwrap(), target);
        assert!(fs::symlink_metadata(&link).is_err());
        assert!(target.exists());

        assert!(matches!(
            delete_entry_impl(&scope, "/etc/hosts"),
            Err(AppError::Permission(_))
        ));
        assert!(matches!(
            delete_entry_impl(&scope, canonical.join("없는.md").to_str().unwrap()),
            Err(AppError::NotFound(_))
        ));
    }

    fn trash_path(name: &str) -> PathBuf {
        PathBuf::from(std::env::var("HOME").expect("HOME"))
            .join(".Trash")
            .join(name)
    }

    // 집행: rust-commands.md#항목-조작 — "macOS는 NSFileManager로 옮긴다".
    // 왜: 크레이트 기본값(Finder)으로 돌아가면 삭제마다 Finder 제어 권한 창이 떠서, 사람이
    //     눌러 주기 전까지 삭제가 멈춘다.
    // 보장: 삭제가 쓰는 컨텍스트를 만드는 함수가 NsFileManager를 고른다.
    // 경계: 삭제가 그 함수를 거치는지는 이 테스트가 보지 못한다 — 크레이트 기본 컨텍스트로
    //       지우는 trash::delete 호출은 clippy.toml이 막는다. 옮긴 결과(휴지통에 나타나고
    //       자리에서 사라짐)는 위 삭제 테스트가 본다.
    #[cfg(target_os = "macos")]
    #[test]
    fn 삭제는_권한을_묻지_않는_방식을_쓴다() {
        use trash::macos::{DeleteMethod, TrashContextExtMacos};

        assert!(matches!(
            trash_context().delete_method(),
            DeleteMethod::NsFileManager
        ));
    }

    // 집행: rust-commands.md#권한-capabilities — 경로 스코프 강제는 커맨드 코드에 있다.
    //       create_file은 "dir가 디렉터리가 아니면 AppError::Io".
    // 왜: 이 검사가 없으면 웹뷰가 허용 루트 밖 아무 폴더에나 파일을 만들 수 있다.
    // 보장: 허용 루트 밖은 Permission, 없는 경로는 NotFound, 파일을 부모로 주면 Io.
    // 경계: 루트 등록(다이얼로그·폴더 열기)은 커맨드 계층 밖의 흐름이다.
    #[test]
    fn 허용_루트_밖과_디렉터리가_아닌_부모는_거부한다() {
        let (_dir, scope, canonical) = scoped_tempdir();
        let outside = tempfile::tempdir().unwrap();
        let file = canonical.join("문서.md");
        fs::write(&file, "").unwrap();

        assert!(matches!(
            create_file_impl(&scope, outside.path().to_str().unwrap(), "회의"),
            Err(AppError::Permission(_))
        ));
        assert!(matches!(
            create_file_impl(&scope, "/no/such/dir", "회의"),
            Err(AppError::NotFound(_))
        ));
        assert!(matches!(
            create_file_impl(&scope, file.to_str().unwrap(), "회의"),
            Err(AppError::Io(_))
        ));
    }
}
