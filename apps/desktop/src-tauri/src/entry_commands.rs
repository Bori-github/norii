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
