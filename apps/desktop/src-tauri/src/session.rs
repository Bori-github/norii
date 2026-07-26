//! 세션 저장·복원 커맨드 — 시그니처의 단일 출처: .claude/docs/rust-commands.md#세션.
//!
//! 세션 파일은 경로 스코프의 세 번째 입구다: 재시작 뒤 다이얼로그 없이 지난 탭을 열 수
//! 있게, Rust가 자기가 쓴 파일에서 읽은 경로만 허용 루트로 등록한다
//! (→ rust-commands.md#권한-capabilities).

use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

use crate::error::AppError;
use crate::scope::FileScope;

const SESSION_FILE: &str = "session.json";

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct SessionTab {
    pub path: String,
    pub cursor_line: u32,
    pub cursor_column: u32,
    pub scroll_line: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub root_dir: Option<String>,
    pub tabs: Vec<SessionTab>,
    pub active: Option<u32>,
}

#[tauri::command]
#[specta::specta]
pub async fn load_session(
    app: AppHandle,
    scope: State<'_, FileScope>,
) -> Result<Option<Session>, AppError> {
    Ok(read_session(&scope, &session_path(&app)?))
}

#[tauri::command]
#[specta::specta]
pub async fn save_session(
    app: AppHandle,
    scope: State<'_, FileScope>,
    session: Session,
) -> Result<(), AppError> {
    write_session(&scope, &session_path(&app)?, &session)
}

fn session_path(app: &AppHandle) -> Result<PathBuf, AppError> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|err| AppError::Io(err.to_string()))?;
    fs::create_dir_all(&dir)?;
    Ok(dir.join(SESSION_FILE))
}

/// 읽고, 지금 존재하는 경로만 남겨 허용 루트로 등록한다. 읽기·해석 실패는 None이다 —
/// 사람이 고칠 수 있는 파일이라 깨진 내용이 기동을 막지 않는다.
fn read_session(scope: &FileScope, file: &Path) -> Option<Session> {
    let stored: Session = serde_json::from_str(&fs::read_to_string(file).ok()?).ok()?;
    Some(remap(&stored, |path, kind| allow(scope, path, kind)))
}

/// 이미 허용된 경로만 기록한다 — 웹뷰가 넘긴 경로가 다음 부팅의 허용 루트가 되지 못한다.
fn write_session(scope: &FileScope, file: &Path, session: &Session) -> Result<(), AppError> {
    let json = remap(session, |path, kind| allowed_only(scope, path, kind));
    let bytes = serde_json::to_vec_pretty(&json).map_err(|err| AppError::Io(err.to_string()))?;
    crate::fs_commands::atomic_write(file, &bytes)
}

#[derive(Clone, Copy, PartialEq)]
enum PathKind {
    Dir,
    File,
}

/// 경로를 걸러 낸 세션을 만든다 — 읽기는 허용을, 쓰기는 허용 확인을 매퍼로 넘긴다.
/// 걸러진 탭이 앞에 있으면 자리가 밀리므로 활성 탭을 남은 목록 기준으로 다시 가리킨다.
/// 활성 탭 자신이 걸러지면 활성 자리는 빈다(프론트가 첫 탭을 세운다 → rust-commands.md#세션).
fn remap(session: &Session, map: impl Fn(&str, PathKind) -> Option<String>) -> Session {
    let root_dir = session
        .root_dir
        .as_deref()
        .and_then(|dir| map(dir, PathKind::Dir));
    let mut tabs = Vec::with_capacity(session.tabs.len());
    let mut active = None;
    for (index, tab) in session.tabs.iter().enumerate() {
        let Some(path) = map(&tab.path, PathKind::File) else {
            continue;
        };
        if session.active == Some(index as u32) {
            active = Some(tabs.len() as u32);
        }
        tabs.push(SessionTab {
            path,
            ..tab.clone()
        });
    }
    Session {
        root_dir,
        tabs,
        active,
    }
}

/// 종류가 맞는 경로만 정규화해 돌려준다 — 탭 자리에 디렉터리가 오면 허용 루트가 그 하위
/// 트리 전체로 넓어진다(손으로 고친 세션 파일의 증폭 경로).
fn canonical_of(path: &str, kind: PathKind) -> Option<PathBuf> {
    let canonical = fs::canonicalize(path).ok()?;
    let is_dir = canonical.is_dir();
    if (kind == PathKind::Dir) == is_dir {
        Some(canonical)
    } else {
        None
    }
}

fn allow(scope: &FileScope, path: &str, kind: PathKind) -> Option<String> {
    let canonical = canonical_of(path, kind)?;
    let text = canonical.to_string_lossy().into_owned();
    scope.allow(canonical);
    Some(text)
}

fn allowed_only(scope: &FileScope, path: &str, kind: PathKind) -> Option<String> {
    let canonical = canonical_of(path, kind)?;
    scope.ensure_allowed(&canonical).ok()?;
    Some(canonical.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tab(path: &str) -> SessionTab {
        SessionTab {
            path: path.to_owned(),
            cursor_line: 8,
            cursor_column: 3,
            scroll_line: 40,
        }
    }

    fn scoped_tempdir() -> (tempfile::TempDir, FileScope) {
        let dir = tempfile::tempdir().expect("임시 디렉터리 생성");
        let scope = FileScope::default();
        scope.allow(fs::canonicalize(dir.path()).expect("canonicalize"));
        (dir, scope)
    }

    // 집행: rust-commands.md#세션 — 저장한 세션이 그대로 돌아오고, 그 경로가 허용된다.
    // 왜: 새 세션의 스코프는 비어 있다(dialog·폴더 열기만 채운다) — 이 등록이 없으면
    //     복원한 탭을 열자마자 Permission으로 거부된다.
    // 보장: 왕복이 탭 목록·활성 탭·탭별 자리를 보존하고, 루트와 탭 경로가 허용된다.
    // 경계: 프론트가 그 값으로 무엇을 하는지는 세션 복원 배선의 몫이다.
    #[test]
    fn 저장한_세션이_그대로_돌아오고_경로가_허용된다() {
        let (dir, scope) = scoped_tempdir();
        let doc = dir.path().join("a.md");
        fs::write(&doc, "본문").unwrap();
        let file = dir.path().join(SESSION_FILE);
        let session = Session {
            root_dir: Some(dir.path().to_string_lossy().into_owned()),
            tabs: vec![tab(doc.to_str().unwrap())],
            active: Some(0),
        };

        write_session(&scope, &file, &session).unwrap();
        let fresh = FileScope::default();
        let restored = read_session(&fresh, &file).expect("세션을 읽는다");

        assert_eq!(restored.tabs.len(), 1);
        assert_eq!(restored.active, Some(0));
        assert_eq!(restored.tabs[0].cursor_line, 8);
        assert_eq!(restored.tabs[0].cursor_column, 3);
        assert_eq!(restored.tabs[0].scroll_line, 40);
        let canonical = fs::canonicalize(&doc).unwrap();
        assert!(fresh.ensure_allowed(&canonical).is_ok());
        assert!(fresh
            .ensure_allowed(&fs::canonicalize(dir.path()).unwrap())
            .is_ok());
    }

    // 왜: 세션 파일은 사람이 고칠 수 있고 첫 실행에는 아예 없다 — 그때 기동이 막히면
    //     설정 파일 하나 때문에 앱을 잃는다(설정 저장과 같은 원칙).
    // 보장: 파일이 없거나 JSON이 깨졌으면 None이고 오류가 아니다.
    #[test]
    fn 없거나_깨진_세션은_none이다() {
        let (dir, scope) = scoped_tempdir();
        let missing = dir.path().join("없는파일.json");
        assert!(read_session(&scope, &missing).is_none());

        let broken = dir.path().join(SESSION_FILE);
        fs::write(&broken, "{ 이건 JSON이 아니다").unwrap();
        assert!(read_session(&scope, &broken).is_none());
    }

    // 왜: 앱을 끈 사이 파일이 지워질 수 있다. 없는 경로를 허용하고 탭으로 세우면 열자마자
    //     실패하는 탭이 남고, 활성 탭 인덱스는 사라진 탭 수만큼 어긋난다.
    // 보장: 사라진 탭은 빠지고, 활성 탭은 남은 목록에서 같은 문서를 가리킨다.
    // 경계: 사라진 탭을 사용자에게 알리는 것은 프론트의 몫이다.
    #[test]
    fn 사라진_탭은_빠지고_활성_탭이_다시_가리킨다() {
        let (dir, scope) = scoped_tempdir();
        let kept = dir.path().join("b.md");
        fs::write(&kept, "본문").unwrap();
        let file = dir.path().join(SESSION_FILE);
        let stored = Session {
            root_dir: None,
            tabs: vec![
                tab(dir.path().join("사라진.md").to_str().unwrap()),
                tab(kept.to_str().unwrap()),
            ],
            active: Some(1),
        };
        fs::write(&file, serde_json::to_vec(&stored).unwrap()).unwrap();

        let restored = read_session(&scope, &file).expect("세션을 읽는다");

        assert_eq!(restored.tabs.len(), 1);
        assert_eq!(restored.active, Some(0));
        assert_eq!(
            restored.tabs[0].path,
            fs::canonicalize(&kept).unwrap().to_string_lossy()
        );
    }

    // 집행: rust-commands.md#세션 — 탭 경로는 파일이고 루트는 디렉터리다.
    // 왜: 허용은 하위 트리 전체를 연다. 탭 자리에 디렉터리("/")가 오면 세션 파일 한 줄이
    //     전역 접근으로 번진다 — config 디렉터리에 쓸 수 있는 같은 사용자 프로세스가
    //     노릴 수 있는 자리다(→ security.md#세션-파일).
    // 보장: 종류가 어긋난 경로는 결과에서 빠지고 허용되지도 않는다.
    #[test]
    fn 종류가_어긋난_경로는_허용하지_않는다() {
        let (dir, _scope) = scoped_tempdir();
        let doc = dir.path().join("a.md");
        fs::write(&doc, "본문").unwrap();
        let file = dir.path().join(SESSION_FILE);
        let stored = Session {
            // 루트 자리에 파일, 탭 자리에 디렉터리 — 손으로 고친 세션이 노리는 모양.
            root_dir: Some(doc.to_string_lossy().into_owned()),
            tabs: vec![tab(dir.path().to_str().unwrap())],
            active: Some(0),
        };
        fs::write(&file, serde_json::to_vec(&stored).unwrap()).unwrap();

        let fresh = FileScope::default();
        let restored = read_session(&fresh, &file).expect("세션을 읽는다");

        assert!(restored.root_dir.is_none());
        assert!(restored.tabs.is_empty());
        assert!(fresh
            .ensure_allowed(&fs::canonicalize(dir.path()).unwrap())
            .is_err());
    }

    // 왜: 활성 탭 자신이 사라지면 인덱스가 남은 목록 밖을 가리킨다 — 그대로 두면 엉뚱한
    //     문서가 활성으로 열린다.
    // 보장: 활성 탭이 걸러지면 활성 자리는 빈다. 범위를 넘는 값도 같다.
    // 경계: 그때 어느 탭을 세울지는 프론트의 몫이다(첫 탭 → app/lib/session-storage).
    #[test]
    fn 활성_탭이_사라지면_활성_자리는_빈다() {
        let (dir, scope) = scoped_tempdir();
        let kept = dir.path().join("b.md");
        fs::write(&kept, "본문").unwrap();
        let file = dir.path().join(SESSION_FILE);
        let stored = Session {
            root_dir: None,
            tabs: vec![
                tab(dir.path().join("사라진.md").to_str().unwrap()),
                tab(kept.to_str().unwrap()),
            ],
            active: Some(0),
        };
        fs::write(&file, serde_json::to_vec(&stored).unwrap()).unwrap();

        let restored = read_session(&scope, &file).expect("세션을 읽는다");
        assert_eq!(restored.tabs.len(), 1);
        assert_eq!(restored.active, None);

        let out_of_range = Session {
            root_dir: None,
            tabs: vec![tab(kept.to_str().unwrap())],
            active: Some(9),
        };
        fs::write(&file, serde_json::to_vec(&out_of_range).unwrap()).unwrap();
        assert_eq!(read_session(&scope, &file).unwrap().active, None);
    }

    // 집행: rust-commands.md#권한-capabilities — 허용 루트는 웹뷰가 선언하지 못한다.
    // 왜: 저장이 아무 경로나 받아 쓰면, 다음 부팅의 load_session이 그것을 허용해
    //     웹뷰가 전역 경로 접근을 얻는다(스코프 강제가 무너진다).
    // 보장: 허용 루트 밖 경로는 기록되지 않고, 활성 탭은 기록된 것 중에서 가리킨다.
    #[test]
    fn 허용되지_않은_경로는_저장되지_않는다() {
        let (dir, scope) = scoped_tempdir();
        let inside = dir.path().join("c.md");
        fs::write(&inside, "본문").unwrap();
        let outside_dir = tempfile::tempdir().unwrap();
        let outside = outside_dir.path().join("남의파일.md");
        fs::write(&outside, "본문").unwrap();
        let file = dir.path().join(SESSION_FILE);

        write_session(
            &scope,
            &file,
            &Session {
                root_dir: Some(outside_dir.path().to_string_lossy().into_owned()),
                tabs: vec![
                    tab(outside.to_str().unwrap()),
                    tab(inside.to_str().unwrap()),
                ],
                active: Some(1),
            },
        )
        .unwrap();

        let fresh = FileScope::default();
        let restored = read_session(&fresh, &file).expect("세션을 읽는다");
        assert_eq!(restored.tabs.len(), 1);
        assert_eq!(restored.active, Some(0));
        assert!(restored.root_dir.is_none());
        assert!(fresh
            .ensure_allowed(&fs::canonicalize(&outside).unwrap())
            .is_err());
    }
}
