//! 파일 열기/저장 커맨드 — 시그니처·동작의 단일 출처: .claude/docs/rust-commands.md.
//! 저장 원자성·충돌 검사·인코딩/EOL 정책: .claude/docs/file-lifecycle.md.
//!
//! 커맨드는 얇은 래퍼이고 실제 로직은 `*_impl`에 있다 — Tauri State 없이 실제 임시
//! 디렉터리로 테스트하기 위해서다(→ .claude/docs/testing.md#레이어별).

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::UNIX_EPOCH;

use serde::Serialize;
use tauri::State;

use crate::content_hash::content_hash;
use crate::eol::{apply_eol, detect_eol, normalize_to_lf, Eol};
use crate::error::AppError;
use crate::scope::FileScope;
use crate::text_encoding::{decode_document, UTF8_BOM};

/// 저장 직렬화 잠금 — 충돌 검사(해시)와 교체(rename) 사이에 다른 저장이 끼어들면 둘 다
/// 검사를 통과해 낡은 내용이 이길 수 있다. 단독 사용자 앱에서 저장은 ms 단위라 전역
/// 직렬화로 충분하다. 외부 프로세스와의 경쟁은 이 잠금 밖의 잔여 위험으로, 저장 직전
/// 해시 검사가 그 창을 최소화한다(→ file-lifecycle.md#저장-원자성과-충돌-검사).
static SAVE_LOCK: Mutex<()> = Mutex::new(());

/// open_file 반환값(→ rust-commands.md). text는 CM6용으로 LF 정규화되어 있고,
/// 저장 시 save_file이 `eol`로 되돌린다(→ file-lifecycle.md#eol-정책).
#[derive(Debug, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct FileContent {
    /// canonicalize된 정식 경로 — 탭 신원·중복 판정·감시 선언의 기준값(→ rust-commands.md).
    pub path: String,
    pub text: String,
    pub encoding: String,
    pub has_bom: bool,
    pub eol: Eol,
    pub eol_mixed: bool,
    /// ms 단위라 2^53 안에 들므로 TS number로 내보낸다(specta는 u64를 기본 금지).
    #[specta(type = specta_typescript::Number)]
    pub mtime: u64,
    pub hash: String,
}

/// save_file 반환값(→ rust-commands.md). hash는 방금 쓴 디스크 바이트의 내용 해시다.
#[derive(Debug, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct SaveResult {
    /// 실제로 쓴 대상의 canonical 경로 — Untitled 첫 저장·다른 이름 저장의 탭 신원도
    /// 다이얼로그 문자열이 아니라 이 값으로 확정한다(→ rust-commands.md).
    pub path: String,
    /// ms 단위라 2^53 안에 들므로 TS number로 내보낸다(specta는 u64를 기본 금지).
    #[specta(type = specta_typescript::Number)]
    pub mtime: u64,
    pub hash: String,
}

#[tauri::command]
#[specta::specta]
pub async fn open_file(
    scope: State<'_, FileScope>,
    path: String,
    encoding_override: Option<String>,
) -> Result<FileContent, AppError> {
    open_file_impl(&scope, &path, encoding_override.as_deref())
}

#[tauri::command]
#[specta::specta]
pub async fn save_file(
    scope: State<'_, FileScope>,
    path: String,
    text: String,
    eol: Eol,
    has_bom: bool,
    expected_hash: Option<String>,
) -> Result<SaveResult, AppError> {
    save_file_impl(&scope, &path, &text, eol, has_bom, expected_hash.as_deref())
}

pub fn open_file_impl(
    scope: &FileScope,
    path: &str,
    encoding_override: Option<&str>,
) -> Result<FileContent, AppError> {
    let canonical = fs::canonicalize(path)?;
    scope.ensure_allowed(&canonical)?;

    let bytes = fs::read(&canonical)?;
    let hash = content_hash(&bytes);
    let decoded = decode_document(&bytes, encoding_override)?;
    // 혼합·CR-only는 eol_mixed=true로 열린다 — 저장의 개행 통일 재작성은 프론트의
    // 정규화 승인을 거친다(→ file-lifecycle.md#eol-정책).
    let eol_info = detect_eol(&decoded.text);

    let mtime = mtime_millis(&fs::metadata(&canonical)?);
    Ok(FileContent {
        path: canonical.to_string_lossy().into_owned(),
        text: normalize_to_lf(&decoded.text),
        encoding: decoded.encoding,
        has_bom: decoded.has_bom,
        eol: eol_info.eol,
        eol_mixed: eol_info.mixed,
        mtime,
        hash,
    })
}

pub fn save_file_impl(
    scope: &FileScope,
    path: &str,
    text: &str,
    eol: Eol,
    has_bom: bool,
    expected_hash: Option<&str>,
) -> Result<SaveResult, AppError> {
    let _save_guard = SAVE_LOCK.lock().expect("SAVE_LOCK은 포이즌되지 않는다");

    // canonicalize로 심볼릭 링크의 "실제 대상"을 찾는다 — 링크를 일반 파일로 교체하지 않기
    // 위해서다(→ file-lifecycle.md#저장-원자성과-충돌-검사). 새 파일은 부모를 canonicalize한다.
    let target = resolve_save_target(Path::new(path))?;
    scope.ensure_allowed(&target)?;

    // 읽기 전용 거부(M2 확정) — rename은 디렉터리 권한만 검사해 파일 잠금을 우회하므로
    // 명시적으로 검사한다. 사용자가 잠근 파일을 자동 저장이 조용히 고치지 않게 하는
    // 규칙이다(→ file-lifecycle.md#저장-원자성과-충돌-검사). 새 파일(메타 없음)은 통과.
    if let Ok(metadata) = fs::metadata(&target) {
        if metadata.permissions().readonly() {
            return Err(AppError::Permission(
                "파일이 읽기 전용입니다 — 쓰기 권한을 부여한 뒤 다시 저장하세요".into(),
            ));
        }
    }

    // 충돌 검사 — 디스크 내용 해시가 탭이 마지막으로 알던 값과 다르면 쓰지 않는다.
    // 새 파일·강제 덮어쓰기는 expected_hash=None으로 검사를 건너뛴다(→ rust-commands.md).
    if let Some(expected) = expected_hash {
        let disk_bytes = fs::read(&target).map_err(|err| match err.kind() {
            std::io::ErrorKind::NotFound => AppError::Conflict(
                "파일이 디스크에서 삭제되었습니다 — 다시 저장하면 새로 생성합니다".into(),
            ),
            _ => AppError::from(err),
        })?;
        if content_hash(&disk_bytes) != expected {
            return Err(AppError::Conflict(
                "저장하려는 파일이 외부에서 수정되었습니다".into(),
            ));
        }
    }

    // 항상 UTF-8로 쓰고, BOM은 원본에 있던 그대로 유지한다(→ file-lifecycle.md#인코딩-정책).
    // 입력은 LF 정규화 계약(CM6)을 따르지만 여기서 한 번 더 정규화한다 — 디스크에 닿기 전
    // 마지막 관문이라, 상류 버그가 깨진 개행(\r\r\n)으로 굳는 것을 막는다(→ eol-정책).
    let body = apply_eol(&normalize_to_lf(text), eol);
    let mut bytes = Vec::with_capacity(body.len() + UTF8_BOM.len());
    if has_bom {
        bytes.extend_from_slice(UTF8_BOM);
    }
    bytes.extend_from_slice(body.as_bytes());

    atomic_write(&target, &bytes)?;

    let mtime = mtime_millis(&fs::metadata(&target)?);
    Ok(SaveResult {
        path: target.to_string_lossy().into_owned(),
        mtime,
        hash: content_hash(&bytes),
    })
}

/// 저장 대상 경로를 canonicalize한다. 파일이 아직 없으면(새 파일) 부모 디렉터리를
/// canonicalize하고 파일명을 다시 붙인다 — 부모가 없으면 NotFound다.
/// 다이얼로그(show_save_dialog)도 같은 해석을 쓴다 — 허용 루트 등록과 저장이 어긋나지 않게.
pub(crate) fn resolve_save_target(path: &Path) -> Result<PathBuf, AppError> {
    match fs::canonicalize(path) {
        Ok(canonical) => return Ok(canonical),
        // "없음"만 새 파일 후보다 — 권한 부족·링크 루프 등 다른 실패를 새 파일로 오인하면
        // rename이 링크를 일반 파일로 교체하게 된다(→ rust-commands.md save_file).
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => {}
        Err(err) => return Err(err.into()),
    }
    // 경로 자체가 남아 있는(깨진) 심볼릭 링크면 거부한다 — 새 파일로 취급해 그 자리에
    // rename하면 링크가 일반 파일로 교체된다. 깨진 링크 열기(NotFound)와 대칭인 동작이다.
    if fs::symlink_metadata(path).is_ok_and(|meta| meta.file_type().is_symlink()) {
        return Err(AppError::NotFound(
            "심볼릭 링크의 대상이 없습니다 — 링크를 일반 파일로 교체하지 않습니다".into(),
        ));
    }
    let parent = path
        .parent()
        .ok_or_else(|| AppError::NotFound("저장 경로에 부모 디렉터리가 없습니다".into()))?;
    let name = path
        .file_name()
        .ok_or_else(|| AppError::NotFound("저장 경로에 파일명이 없습니다".into()))?;
    Ok(fs::canonicalize(parent)?.join(name))
}

/// 원자적 쓰기 — 같은 디렉터리의 임시 파일에 쓰고 원본 권한을 복사한 뒤 rename으로 교체한다.
/// 저장 중 크래시가 나도 디스크에는 온전한 옛 파일 아니면 온전한 새 파일만 남는다
/// (→ file-lifecycle.md#저장-원자성과-충돌-검사).
fn atomic_write(target: &Path, bytes: &[u8]) -> Result<(), AppError> {
    let dir = target
        .parent()
        .ok_or_else(|| AppError::NotFound("저장 경로에 부모 디렉터리가 없습니다".into()))?;
    let mut temp = tempfile::NamedTempFile::new_in(dir)?;
    temp.write_all(bytes)?;
    // rename 전에 내용을 디스크에 내려놓는다 — 전원 차단 시 "빈 새 파일"이 남는 것을 막는다.
    temp.as_file().sync_all()?;
    if let Ok(metadata) = fs::metadata(target) {
        fs::set_permissions(temp.path(), metadata.permissions())?;
    } else {
        // 새 파일 — tempfile 기본값(0600)은 임시 파일용 보안 기본값이라, 그대로 남기면
        // 다른 도구·계정이 문서를 읽지 못한다. 일반 문서 관례(0644)로 맞춘다.
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(temp.path(), fs::Permissions::from_mode(0o644))?;
        }
    }
    temp.persist(target)
        .map_err(|err| AppError::from(err.error))?;
    Ok(())
}

pub(crate) fn mtime_millis(metadata: &fs::Metadata) -> u64 {
    metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::os::unix::fs::PermissionsExt;

    fn scoped_tempdir() -> (tempfile::TempDir, FileScope) {
        let dir = tempfile::tempdir().expect("임시 디렉터리 생성");
        let scope = FileScope::default();
        scope.allow(fs::canonicalize(dir.path()).expect("canonicalize"));
        (dir, scope)
    }

    // 집행: testing.md#위험-영역은-실제-앱으로-검증-핵심 — "파일 왕복: 저장 → 다시 읽어
    //       내용·인코딩·개행이 보존되는지"의 백엔드 계층 검증.
    // 왜: 열기→편집→저장→다시 열기에서 내용이 변하면 데이터 유실이다(최우선 방어 대상).
    // 보장: UTF-8/LF 문서의 저장·재열기가 편집 내용을 정확히 보존하고, 해시·mtime을 반환한다.
    // 경계: 실제 웹뷰·IPC를 거치는 왕복은 E2E가 검증한다 — 여기는 Rust 계층만.
    #[test]
    fn utf8_lf_문서의_열기_편집_저장_왕복이_내용을_보존한다() {
        let (dir, scope) = scoped_tempdir();
        let path = dir.path().join("doc.md");
        fs::write(&path, "# 제목\n본문\n").unwrap();
        let path = path.to_str().unwrap();

        let opened = open_file_impl(&scope, path, None).unwrap();
        assert_eq!(opened.text, "# 제목\n본문\n");
        assert_eq!(opened.eol, Eol::Lf);
        assert!(!opened.eol_mixed);

        let edited = "# 제목\n본문 수정\n";
        let saved = save_file_impl(
            &scope,
            path,
            edited,
            opened.eol,
            opened.has_bom,
            Some(&opened.hash),
        )
        .unwrap();

        let reopened = open_file_impl(&scope, path, None).unwrap();
        assert_eq!(reopened.text, edited);
        assert_eq!(reopened.hash, saved.hash);
    }

    // 집행: file-lifecycle.md#eol-정책 — "기존 EOL 유지"·"CM6 내부는 LF, 저장 시 되돌림".
    // 왜: CRLF 파일을 열었다 저장만 해도 LF로 바뀐다면 사용자가 입력하지 않은
    //     바이트 재작성이 일어난다(git diff 오염·정규화 승인 우회).
    // 보장: CRLF 파일은 LF로 정규화되어 열리고(eol="crlf"), 편집 없이 저장하면
    //       디스크 바이트가 원본과 동일하다(무손실 왕복).
    // 경계: 혼합 EOL은 M1에서 열리지 않는다(아래 거부 테스트).
    #[test]
    fn crlf_문서는_lf로_열리고_저장_시_crlf로_복원된다() {
        let (dir, scope) = scoped_tempdir();
        let path = dir.path().join("doc.md");
        let original = "# a\r\n\r\nb\r\n";
        fs::write(&path, original).unwrap();
        let path = path.to_str().unwrap();

        let opened = open_file_impl(&scope, path, None).unwrap();
        assert_eq!(opened.text, "# a\n\nb\n");
        assert_eq!(opened.eol, Eol::Crlf);

        save_file_impl(
            &scope,
            path,
            &opened.text,
            opened.eol,
            opened.has_bom,
            Some(&opened.hash),
        )
        .unwrap();
        assert_eq!(fs::read(path).unwrap(), original.as_bytes());
    }

    // 집행: file-lifecycle.md#인코딩-정책 — "BOM 유무가 저장만으로 바뀌지 않는다".
    // 왜: BOM이 사라지거나 생기면 다른 도구(빌드 스크립트 등)와의 호환이 조용히 깨진다.
    // 보장: BOM 파일은 본문에서 BOM 없이 열리고, 저장하면 BOM이 되살아난다.
    // 경계: UTF-16 BOM은 M1 거부 대상이라 다루지 않는다(text_encoding 테스트).
    #[test]
    fn utf8_bom_은_저장_시_원본대로_복원된다() {
        let (dir, scope) = scoped_tempdir();
        let path = dir.path().join("doc.md");
        let mut original = vec![0xEF, 0xBB, 0xBF];
        original.extend_from_slice("# a\n".as_bytes());
        fs::write(&path, &original).unwrap();
        let path = path.to_str().unwrap();

        let opened = open_file_impl(&scope, path, None).unwrap();
        assert_eq!(opened.text, "# a\n");
        assert!(opened.has_bom);

        save_file_impl(
            &scope,
            path,
            &opened.text,
            opened.eol,
            opened.has_bom,
            Some(&opened.hash),
        )
        .unwrap();
        assert_eq!(fs::read(path).unwrap(), original);
    }

    // 집행: file-lifecycle.md#저장-원자성과-충돌-검사 — 해시 불일치면 쓰지 않고 Conflict.
    // 왜: watch 이벤트가 없는 M1에서 이 검사가 외부 변경 데이터 유실의 유일한 방어선이다.
    // 보장: 외부 수정 후 낡은 expected_hash로 저장하면 Conflict가 반환되고
    //       디스크의 외부 수정본이 그대로 남는다(덮어쓰지 않음).
    // 경계: 충돌 해소 UI(디스크/편집 선택)는 프론트 소관이다.
    #[test]
    fn 외부_수정_후_저장은_conflict_로_거부되고_디스크를_보존한다() {
        let (dir, scope) = scoped_tempdir();
        let path = dir.path().join("doc.md");
        fs::write(&path, "원본\n").unwrap();
        let path = path.to_str().unwrap();

        let opened = open_file_impl(&scope, path, None).unwrap();
        fs::write(path, "외부 수정\n").unwrap();

        let result = save_file_impl(
            &scope,
            path,
            "내 편집\n",
            opened.eol,
            false,
            Some(&opened.hash),
        );
        assert!(matches!(result, Err(AppError::Conflict(_))));
        assert_eq!(fs::read_to_string(path).unwrap(), "외부 수정\n");
    }

    // 집행: rust-commands.md save_file — 열려 있던 파일이 삭제된 채 낡은 해시로 저장하면 Conflict.
    // 왜: 삭제를 조용히 재생성으로 덮으면 사용자가 밖에서 지운 파일이 되살아난다.
    // 보장: expected_hash가 있는데 파일이 없으면 Conflict다(새로 생성은 None으로 명시).
    // 경계: file-removed 이벤트 흐름은 M2(watch)에서 다룬다.
    #[test]
    fn 삭제된_파일에_낡은_해시로_저장하면_conflict_다() {
        let (dir, scope) = scoped_tempdir();
        let path = dir.path().join("doc.md");
        fs::write(&path, "원본\n").unwrap();
        let path_str = path.to_str().unwrap();

        let opened = open_file_impl(&scope, path_str, None).unwrap();
        fs::remove_file(&path).unwrap();

        let result = save_file_impl(
            &scope,
            path_str,
            "내 편집\n",
            opened.eol,
            false,
            Some(&opened.hash),
        );
        assert!(matches!(result, Err(AppError::Conflict(_))));
        assert!(!path.exists());
    }

    // 집행: rust-commands.md save_file — 새 파일·강제 덮어쓰기는 expected_hash=None.
    // 왜: Untitled 첫 저장과 충돌 해소("편집 버전 선택")가 이 경로를 쓴다.
    // 보장: None이면 검사 없이 새 파일이 생성된다.
    // 경계: 다이얼로그로 경로를 얻는 흐름은 커맨드 밖(프론트) 소관이다.
    #[test]
    fn expected_hash_none_이면_새_파일을_생성한다() {
        let (dir, scope) = scoped_tempdir();
        let path = dir.path().join("new.md");
        let path = path.to_str().unwrap();

        let saved = save_file_impl(&scope, path, "새 문서\n", Eol::Lf, false, None).unwrap();
        assert_eq!(fs::read_to_string(path).unwrap(), "새 문서\n");
        assert_eq!(saved.hash, content_hash("새 문서\n".as_bytes()));
    }

    // 집행: rust-commands.md#권한-capabilities — 경로 스코프 강제는 커맨드 내부 검증이다.
    // 왜: 웹뷰가 손상되어도 허용 루트 밖의 파일은 읽고 쓸 수 없어야 한다.
    // 보장: 허용 루트 밖 경로의 open/save가 Permission으로 거부되고 파일이 생기지 않는다.
    // 경계: 다이얼로그가 루트를 추가하는 정상 흐름은 dialog 커맨드 계층에서 다룬다.
    #[test]
    fn 허용_루트_밖_경로는_open_save_모두_거부한다() {
        let (_dir, scope) = scoped_tempdir();
        let outside = tempfile::tempdir().unwrap();
        let path = outside.path().join("secret.md");
        fs::write(&path, "밖\n").unwrap();
        let path_str = path.to_str().unwrap();

        assert!(matches!(
            open_file_impl(&scope, path_str, None),
            Err(AppError::Permission(_))
        ));
        let escape = outside.path().join("escape.md");
        assert!(matches!(
            save_file_impl(&scope, escape.to_str().unwrap(), "x", Eol::Lf, false, None),
            Err(AppError::Permission(_))
        ));
        assert!(!escape.exists());
    }

    // 집행: file-lifecycle.md#eol-정책 — 혼합 EOL은 eol_mixed로 표시해 열고(M2), 저장 시
    //       판정 EOL(다수결)로 통일한다. 통일 재작성은 프론트의 정규화 승인을 거친다.
    // 왜: 혼합 EOL 문서를 여는 것이 M2 파일 강건성의 목표이고, eol_mixed 플래그가
    //     프론트 승인 게이트(자동 저장 차단·배너)의 유일한 근거다.
    // 보장: 혼합 파일이 LF 정규화 본문 + eol_mixed=true + 다수결 판정으로 열리고,
    //       저장하면 디스크 개행이 판정 EOL로 통일된다(승인 후 첫 저장 = 변환 1회).
    // 경계: 승인 전 저장을 막는 것은 프론트 게이트 소관 — 커맨드는 항상 저장을 수행한다.
    #[test]
    fn 혼합_eol_파일은_eol_mixed로_열리고_저장이_판정_eol로_통일한다() {
        let (dir, scope) = scoped_tempdir();
        let path = dir.path().join("mixed.md");
        fs::write(&path, "a\r\nb\nc\r\n").unwrap(); // CRLF 2 vs LF 1 → 판정 crlf
        let path = path.to_str().unwrap();

        let opened = open_file_impl(&scope, path, None).unwrap();
        assert_eq!(opened.text, "a\nb\nc\n");
        assert_eq!(opened.eol, Eol::Crlf);
        assert!(opened.eol_mixed);

        save_file_impl(
            &scope,
            path,
            &opened.text,
            opened.eol,
            opened.has_bom,
            Some(&opened.hash),
        )
        .unwrap();
        assert_eq!(fs::read(path).unwrap(), b"a\r\nb\r\nc\r\n");

        // 통일 후 다시 열면 더는 혼합이 아니다 — 변환은 1회로 끝난다.
        let reopened = open_file_impl(&scope, path, None).unwrap();
        assert!(!reopened.eol_mixed);
    }

    // 집행: file-lifecycle.md#인코딩-정책 — "비UTF-8은 감지 후 변환해 열기…저장하기 전까지
    //       파일은 바뀌지 않는다", 저장은 항상 UTF-8.
    // 왜: EUC-KR 레거시 한글 문서의 열기→승인→저장이 M2의 대표 사용자 시나리오다.
    // 보장: EUC-KR 파일이 변환되어 열리고(원본 불변), 저장하면 UTF-8 바이트로 통일되며,
    //       다시 열면 utf-8로 판정된다.
    // 경계: 승인 UI 흐름은 프론트·E2E 소관 — 여기는 커맨드 왕복만.
    #[test]
    fn euc_kr_파일은_변환해_열리고_저장하면_utf8이_된다() {
        use crate::text_encoding::test_support::{EUC_KR_SAMPLE, EUC_KR_SAMPLE_TEXT};

        let (dir, scope) = scoped_tempdir();
        let path = dir.path().join("legacy.md");
        fs::write(&path, EUC_KR_SAMPLE).unwrap();
        let path = path.to_str().unwrap();

        let opened = open_file_impl(&scope, path, None).unwrap();
        assert_eq!(opened.text, EUC_KR_SAMPLE_TEXT);
        assert_eq!(opened.encoding, "euc-kr");
        // 열기만으로는 원본이 바뀌지 않는다.
        assert_eq!(fs::read(path).unwrap(), EUC_KR_SAMPLE);

        save_file_impl(
            &scope,
            path,
            &opened.text,
            opened.eol,
            opened.has_bom,
            Some(&opened.hash),
        )
        .unwrap();
        assert_eq!(fs::read(path).unwrap(), EUC_KR_SAMPLE_TEXT.as_bytes());
        assert_eq!(
            open_file_impl(&scope, path, None).unwrap().encoding,
            "utf-8"
        );
    }

    // 집행: file-lifecycle.md#저장-원자성과-충돌-검사 — 읽기 전용 거부(M2 확정 열린 결정)
    //       + rust-commands.md save_file.
    // 왜: 원자적 쓰기(rename)는 디렉터리 권한만 검사해 파일 잠금을 우회한다(E2E 실측) —
    //     사용자가 일부러 잠근 파일을 자동 저장이 조용히 고치면 잠금의 의도가 깨진다.
    // 보장: 쓰기 권한 없는 파일의 저장이 Permission으로 거부되고 내용·권한이 그대로다.
    // 경계: 명시적 덮어쓰기 UI는 미도입(필요 시 추후) — 구제는 chmod 후 재저장이다.
    #[test]
    fn 읽기_전용_파일_저장은_permission으로_거부한다() {
        let (dir, scope) = scoped_tempdir();
        let path = dir.path().join("locked.md");
        fs::write(&path, "잠긴 원본\n").unwrap();
        let path_str = path.to_str().unwrap();
        let opened = open_file_impl(&scope, path_str, None).unwrap();
        fs::set_permissions(&path, fs::Permissions::from_mode(0o444)).unwrap();

        let result = save_file_impl(
            &scope,
            path_str,
            "수정\n",
            opened.eol,
            false,
            Some(&opened.hash),
        );

        assert!(matches!(result, Err(AppError::Permission(_))));
        assert_eq!(fs::read_to_string(&path).unwrap(), "잠긴 원본\n");
        // 정리 — TempDir 삭제가 실패하지 않게 권한을 되돌린다.
        fs::set_permissions(&path, fs::Permissions::from_mode(0o644)).unwrap();
    }

    // 집행: file-lifecycle.md#저장-원자성과-충돌-검사 — 임시 파일에 "원본 권한을 복사한 뒤" rename.
    // 왜: 원자적 쓰기는 파일을 새로 만들므로, 권한 복사가 없으면 chmod한 파일이
    //     저장할 때마다 기본 권한으로 리셋된다.
    // 보장: 0o600 파일을 저장해도 권한이 유지되고, 임시 파일이 디렉터리에 남지 않는다.
    // 경계: 소유자·ACL·xattr 보존은 다루지 않는다(단독 사용자 로컬 파일 전제).
    #[test]
    fn 저장은_원본_권한을_유지하고_임시_파일을_남기지_않는다() {
        let (dir, scope) = scoped_tempdir();
        let path = dir.path().join("doc.md");
        fs::write(&path, "원본\n").unwrap();
        fs::set_permissions(&path, fs::Permissions::from_mode(0o600)).unwrap();
        let path_str = path.to_str().unwrap();

        let opened = open_file_impl(&scope, path_str, None).unwrap();
        save_file_impl(
            &scope,
            path_str,
            "수정\n",
            opened.eol,
            false,
            Some(&opened.hash),
        )
        .unwrap();

        let mode = fs::metadata(&path).unwrap().permissions().mode() & 0o777;
        assert_eq!(mode, 0o600);
        let entries: Vec<_> = fs::read_dir(dir.path()).unwrap().collect();
        assert_eq!(entries.len(), 1, "임시 파일이 남아 있으면 안 된다");
    }

    // 집행: file-lifecycle.md#저장-원자성과-충돌-검사 — canonicalize로 심볼릭 링크의
    //       "실제 대상"에 저장한다(링크를 일반 파일로 교체하지 않음).
    // 왜: 링크 경로에 rename하면 링크 자체가 일반 파일로 바뀌어 원본은 낡은 채 남는다.
    // 보장: 링크로 저장하면 링크는 링크로 남고 실제 대상의 내용이 갱신된다.
    // 경계: 루트 밖을 가리키는 링크의 거부는 스코프 테스트 원리와 동일해 별도로 다루지 않는다.
    #[test]
    fn 심볼릭_링크로_저장하면_실제_대상이_갱신되고_링크는_유지된다() {
        let (dir, scope) = scoped_tempdir();
        let real = dir.path().join("real.md");
        let link = dir.path().join("link.md");
        fs::write(&real, "원본\n").unwrap();
        std::os::unix::fs::symlink(&real, &link).unwrap();
        let link_str = link.to_str().unwrap();

        let opened = open_file_impl(&scope, link_str, None).unwrap();
        save_file_impl(
            &scope,
            link_str,
            "수정\n",
            opened.eol,
            false,
            Some(&opened.hash),
        )
        .unwrap();

        assert!(fs::symlink_metadata(&link)
            .unwrap()
            .file_type()
            .is_symlink());
        assert_eq!(fs::read_to_string(&real).unwrap(), "수정\n");
    }

    // 집행: file-lifecycle.md#저장-원자성과-충돌-검사 — 프로세스 안 동시 저장은 전역 잠금으로
    //       직렬화한다.
    // 왜: 자동 저장 디바운스와 Cmd+S가 겹치면 둘 다 같은 해시 검사를 통과해, rename 순서에
    //     따라 낡은 내용이 최종본이 될 수 있다(적대적 리뷰 OV1).
    // 보장: 같은 expected_hash로 동시에 저장하면 정확히 한쪽만 성공하고 다른 쪽은 Conflict,
    //       디스크에는 성공한 쪽 내용이 남는다.
    // 경계: 외부 프로세스와의 경쟁(TOCTOU)은 프로세스 내 잠금 밖 — 문서화된 잔여 위험이다.
    #[test]
    fn 같은_해시로_동시_저장하면_한쪽만_성공하고_한쪽은_conflict_다() {
        let (dir, scope) = scoped_tempdir();
        let path = dir.path().join("doc.md");
        fs::write(&path, "원본\n").unwrap();
        let path = path.to_str().unwrap();
        let opened = open_file_impl(&scope, path, None).unwrap();

        let texts = ["편집 A\n", "편집 B\n"];
        let results: Vec<Result<SaveResult, AppError>> = std::thread::scope(|threads| {
            let handles: Vec<_> = texts
                .iter()
                .map(|text| {
                    let scope = &scope;
                    let hash = opened.hash.as_str();
                    threads.spawn(move || {
                        save_file_impl(scope, path, text, Eol::Lf, false, Some(hash))
                    })
                })
                .collect();
            handles.into_iter().map(|h| h.join().unwrap()).collect()
        });

        let ok_count = results.iter().filter(|r| r.is_ok()).count();
        let conflict_count = results
            .iter()
            .filter(|r| matches!(r, Err(AppError::Conflict(_))))
            .count();
        assert_eq!((ok_count, conflict_count), (1, 1));
        // 디스크에는 성공한 쪽 내용이 남는다.
        let winner = results.iter().position(|r| r.is_ok()).unwrap();
        assert_eq!(fs::read_to_string(path).unwrap(), texts[winner]);
    }

    // 집행: rust-commands.md save_file — "링크를 일반 파일로 교체하지 않음".
    // 왜: 깨진 링크를 "새 파일"로 오인해 그 자리에 rename하면 링크가 일반 파일로 교체된다
    //     (적대적 리뷰 OV2 — canonicalize 실패 사유를 삼키던 문제).
    // 보장: 대상이 사라진 심볼릭 링크에 저장하면 NotFound로 거부되고 링크는 링크로 남는다.
    // 경계: EACCES·ELOOP 등 다른 실패 사유는 이식성 있는 재현이 어려워 전파 로직으로만 다룬다.
    #[test]
    fn 깨진_심볼릭_링크에_저장하면_링크를_교체하지_않고_거부한다() {
        let (dir, scope) = scoped_tempdir();
        let missing = dir.path().join("missing.md");
        let link = dir.path().join("link.md");
        std::os::unix::fs::symlink(&missing, &link).unwrap();

        let result = save_file_impl(&scope, link.to_str().unwrap(), "x\n", Eol::Lf, false, None);
        assert!(matches!(result, Err(AppError::NotFound(_))));
        assert!(fs::symlink_metadata(&link)
            .unwrap()
            .file_type()
            .is_symlink());
        assert!(!missing.exists());
    }

    // 집행: file-lifecycle.md#저장-원자성과-충돌-검사 — 새 파일의 권한 관례.
    // 왜: tempfile 기본 권한(0600)이 남으면 다른 도구·계정이 문서를 읽지 못한다(적대적 리뷰 이슈 1).
    // 보장: 새 파일은 일반 문서 관례인 0644로 생성된다.
    // 경계: umask가 더 엄격한 환경의 정책 반영은 하지 않는다(단독 데스크탑 앱 전제).
    #[test]
    fn 새_파일은_관례적_권한_0644로_생성된다() {
        let (dir, scope) = scoped_tempdir();
        let path = dir.path().join("new.md");
        save_file_impl(
            &scope,
            path.to_str().unwrap(),
            "새 문서\n",
            Eol::Lf,
            false,
            None,
        )
        .unwrap();
        let mode = fs::metadata(&path).unwrap().permissions().mode() & 0o777;
        assert_eq!(mode, 0o644);
    }

    // 집행: file-lifecycle.md#eol-정책 — 저장은 디스크에 닿기 전 마지막 관문에서 개행을 정규화한다.
    // 왜: 상류(CM6 LF 계약)가 깨져 CRLF가 섞인 텍스트가 오면, 무방비 치환은 \r\r\n을
    //     디스크에 굳힌다(적대적 리뷰 이슈 2).
    // 보장: 어떤 개행이 섞여 와도 디스크에는 판정 EOL의 올바른 개행만 기록된다.
    // 경계: 상류 계약 자체(CM6 정규화)는 프론트·E2E가 검증한다.
    #[test]
    fn 저장은_입력_개행을_정규화해_깨진_개행을_쓰지_않는다() {
        let (dir, scope) = scoped_tempdir();
        let path = dir.path().join("doc.md");
        save_file_impl(
            &scope,
            path.to_str().unwrap(),
            "a\r\nb\nc\r",
            Eol::Crlf,
            false,
            None,
        )
        .unwrap();
        assert_eq!(fs::read(&path).unwrap(), b"a\r\nb\r\nc\r\n");
    }

    // 집행: rust-commands.md#권한-capabilities — "canonicalize로 심볼릭 링크를 통한 스코프
    //       탈출도 차단".
    // 왜: 허용 루트 안에 밖을 가리키는 링크를 두면 보호 구역 밖 파일을 읽고 쓸 수 있는지가
    //     경로 보안의 핵심 속성인데, 주석으로만 보장되어 있었다(적대적 리뷰 T3).
    // 보장: 루트 밖을 가리키는 링크는 열기·저장 모두 Permission으로 거부되고 밖 파일은 불변이다.
    // 경계: 루트 안을 가리키는 링크의 정상 동작은 별도 테스트가 다룬다.
    #[test]
    fn 루트_밖을_가리키는_심볼릭_링크는_열기와_저장_모두_거부한다() {
        let (dir, scope) = scoped_tempdir();
        let outside = tempfile::tempdir().unwrap();
        let secret = outside.path().join("secret.md");
        fs::write(&secret, "밖\n").unwrap();
        let link = dir.path().join("escape.md");
        std::os::unix::fs::symlink(&secret, &link).unwrap();
        let link_str = link.to_str().unwrap();

        assert!(matches!(
            open_file_impl(&scope, link_str, None),
            Err(AppError::Permission(_))
        ));
        assert!(matches!(
            save_file_impl(&scope, link_str, "침입\n", Eol::Lf, false, None),
            Err(AppError::Permission(_))
        ));
        assert_eq!(fs::read_to_string(&secret).unwrap(), "밖\n");
    }

    // 집행: rust-commands.md open_file — 파일 없음은 AppError::NotFound로 명시 반환한다.
    // 왜: 프론트가 "파일 없음"을 구분된 메시지로 안내해야 한다(→ error-handling.md).
    // 보장: 존재하지 않는 경로의 open이 NotFound다.
    // 경계: 깨진 심볼릭 링크의 NotFound는 read_dir(M4) 시나리오에서 다룬다.
    #[test]
    fn 없는_파일의_열기는_notfound_다() {
        let (dir, scope) = scoped_tempdir();
        let path = dir.path().join("ghost.md");
        assert!(matches!(
            open_file_impl(&scope, path.to_str().unwrap(), None),
            Err(AppError::NotFound(_))
        ));
    }

    // 집행: rust-commands.md open_file — "path는 canonicalize된 정식 경로다".
    // 왜: 탭 신원이 요청 문자열이면 같은 파일이 별칭(/tmp↔/private/tmp·대소문자·NFC/NFD)
    //     으로 두 번 열려, 두 탭의 저장이 서로를 외부 변경으로 오인한다(M5 트리 = 새 입구).
    // 보장: 어떤 표기로 요청해도 반환 path가 디스크의 정식 경로 한 값으로 수렴한다.
    // 경계: 프론트가 이 값을 실제 신원으로 쓰는지는 프론트 테스트가 검증한다.
    #[test]
    fn 열기는_요청_표기와_무관하게_canonical_경로를_반환한다() {
        // mac의 tempdir는 /var/…(실제는 /private/var/…)라 요청 표기와 정식 표기가
        // 실제로 갈라지는 환경이다 — 그 갈라짐이 없는 플랫폼에서도 동등성은 성립한다.
        let (dir, scope) = scoped_tempdir();
        let path = dir.path().join("doc.md");
        fs::write(&path, "본문\n").unwrap();

        let opened = open_file_impl(&scope, path.to_str().unwrap(), None).unwrap();
        let canonical = fs::canonicalize(&path).unwrap();
        assert_eq!(opened.path, canonical.to_str().unwrap());
    }

    // 왜: 심볼릭 링크는 한 파일의 두 번째 표기다 — 링크 표기가 신원으로 남으면 중복 탭을
    //     막을 수 없다.
    // 보장: 링크로 열어도 대상 파일로 연 것과 같은 path가 나온다(한 신원으로 수렴).
    // 경계: 루트 밖을 가리키는 링크는 스코프 거부 테스트가 다룬다.
    #[test]
    fn 링크로_열어도_대상과_같은_canonical_경로로_수렴한다() {
        let (dir, scope) = scoped_tempdir();
        let real = dir.path().join("real.md");
        fs::write(&real, "본문\n").unwrap();
        let link = dir.path().join("link.md");
        std::os::unix::fs::symlink(&real, &link).unwrap();

        let via_link = open_file_impl(&scope, link.to_str().unwrap(), None).unwrap();
        let via_real = open_file_impl(&scope, real.to_str().unwrap(), None).unwrap();
        assert_eq!(via_link.path, via_real.path);
    }

    // 집행: rust-commands.md save_file — "path는 저장이 실제로 쓴 대상의 canonical 경로다".
    // 왜: Untitled 첫 저장·다른 이름 저장이 다이얼로그 문자열을 신원으로 삼으면,
    //     열기(canonical 신원)와 표기가 어긋나 같은 파일이 두 신원을 가진다.
    // 보장: 아직 없던 새 파일의 저장도 부모 canonicalize 기준의 정식 경로를 반환한다.
    // 경계: 기존 파일 저장은 열기와 같은 canonicalize 경로라 새 파일 경우만 고정한다.
    #[test]
    fn 새_파일_저장은_canonical_경로를_반환한다() {
        let (dir, scope) = scoped_tempdir();
        let path = dir.path().join("new.md");

        let saved = save_file_impl(
            &scope,
            path.to_str().unwrap(),
            "본문\n",
            Eol::Lf,
            false,
            None,
        )
        .unwrap();
        let canonical = fs::canonicalize(&path).unwrap();
        assert_eq!(saved.path, canonical.to_str().unwrap());
    }
}
