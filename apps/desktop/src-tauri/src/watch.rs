//! 파일 외부 변경 감시(watch_paths) — 계약의 단일 출처: .claude/docs/rust-commands.md.
//! 이벤트를 받은 프론트의 처리 정책(에코 억제·리로드·충돌)은
//! .claude/docs/file-lifecycle.md#외부-변경-처리가 단일 출처다.
//!
//! 구현 계약: 파일이 아니라 부모 디렉터리를 감시하고 경로로 필터한다 — 외부 에디터의
//! 원자적 저장(rename 교체)에도 감시가 끊기지 않는다(VS Code와 동일 전략).

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use notify::{RecursiveMode, Watcher};
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::content_hash::content_hash;
use crate::error::AppError;
use crate::fs_commands::{mtime_millis, resolve_save_target};
use crate::scope::FileScope;

/// 삭제 유예 — rename 교체의 순간 삭제를 삭제로 오판하지 않도록 재확인 전에 기다리는 시간
/// (→ rust-commands.md watch_paths).
const REMOVAL_GRACE: Duration = Duration::from_millis(100);

/// 감시가 감지한 사건. 커맨드 층이 Tauri 이벤트로 변환하고, 테스트는 채널로 받는다.
/// path는 프론트가 watch_paths에 준 **원래 경로 문자열**이다 — canonical 경로를 실으면
/// 프론트가 탭(filePath)과 대조할 수 없다(/tmp ↔ /private/tmp 등 심볼릭 링크 차이).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum WatchEvent {
    Changed {
        path: String,
        mtime: u64,
        hash: String,
    },
    Removed {
        path: String,
    },
}

/// 감시 코어 — 선언적 교체(replace)만 제공한다. Tauri 없이 실제 파일시스템으로 테스트한다.
#[derive(Default)]
pub struct FileWatcher {
    /// Some = 감시 중. 교체 시 드롭되면서 이전 구독이 해제된다.
    inner: Option<notify::RecommendedWatcher>,
    /// 세대 토큰 — 감시 백엔드(FSEvents)의 해제는 비동기라, 드롭 직후에도 이전 구독의
    /// 이벤트가 잠깐 새어 나올 수 있다(실측). 교체 시 세대를 올리고 콜백·유예 스레드가
    /// 발신 직전에 세대를 검사해, "호출 시 이전 감시는 모두 해제" 계약을 즉시 성립시킨다.
    generation: Arc<AtomicU64>,
}

impl FileWatcher {
    /// 감시 대상 전체를 교체한다(누적 아님 — 이전 감시는 모두 해제).
    /// `targets`는 canonical 파일 경로 → 원래 요청 경로의 맵이다.
    pub fn replace(
        &mut self,
        targets: HashMap<PathBuf, String>,
        on_event: impl Fn(WatchEvent) + Send + Sync + 'static,
    ) -> Result<(), AppError> {
        // 세대를 먼저 올려 이전 구독의 늦은 이벤트를 무효화하고, watcher를 드롭해 해제한다.
        let token = self.generation.fetch_add(1, Ordering::SeqCst) + 1;
        self.inner = None;
        if targets.is_empty() {
            return Ok(());
        }

        // 부모 디렉터리를 감시하고 경로로 필터한다(계약). 같은 폴더의 파일들은 구독 하나를 공유한다.
        let dirs: HashSet<PathBuf> = targets
            .keys()
            .filter_map(|path| path.parent().map(Path::to_path_buf))
            .collect();

        let targets = Arc::new(targets);
        let on_event: Arc<dyn Fn(WatchEvent) + Send + Sync> = Arc::new(on_event);
        let generation = Arc::clone(&self.generation);
        let mut watcher =
            notify::recommended_watcher(move |result: notify::Result<notify::Event>| {
                // 낡은 세대(교체 전 구독)의 늦은 이벤트는 버린다.
                if generation.load(Ordering::SeqCst) != token {
                    return;
                }
                // 감시 백엔드의 에러(큐 넘침 등)는 무시한다 — 이벤트가 유실돼도 저장 직전
                // 해시 검사가 마지막 방어선이다(→ file-lifecycle.md#저장-원자성과-충돌-검사).
                let Ok(event) = result else { return };
                for event_path in &event.paths {
                    if let Some(original) = targets.get(event_path.as_path()) {
                        probe_and_notify(
                            event_path.clone(),
                            original.clone(),
                            Arc::clone(&on_event),
                            Arc::clone(&generation),
                            token,
                        );
                    }
                }
            })
            .map_err(watch_error)?;

        for dir in &dirs {
            watcher
                .watch(dir, RecursiveMode::NonRecursive)
                .map_err(watch_error)?;
        }
        self.inner = Some(watcher);
        Ok(())
    }
}

/// 이벤트 시점의 디스크 상태를 확인해 알린다. 파일이 있으면 즉시 Changed(그 시점 해시),
/// 없으면 유예(100ms) 후 재확인 — 다시 있으면 Changed, 정말 없으면 Removed
/// (rename 교체의 순간 삭제를 삭제로 오판하지 않는 계약 동작).
/// notify 콜백 스레드에서 자면 후속 이벤트가 밀리므로 스레드를 분리하고,
/// 발신 직전에 세대를 재검사한다 — 유예 중에 감시가 교체됐으면 발신하지 않는다.
fn probe_and_notify(
    path: PathBuf,
    original: String,
    on_event: Arc<dyn Fn(WatchEvent) + Send + Sync>,
    generation: Arc<AtomicU64>,
    token: u64,
) {
    std::thread::spawn(move || {
        let emit = |event: WatchEvent| {
            if generation.load(Ordering::SeqCst) == token {
                on_event(event);
            }
        };
        if let Some((mtime, hash)) = probe(&path) {
            emit(WatchEvent::Changed {
                path: original,
                mtime,
                hash,
            });
            return;
        }
        std::thread::sleep(REMOVAL_GRACE);
        match probe(&path) {
            Some((mtime, hash)) => emit(WatchEvent::Changed {
                path: original,
                mtime,
                hash,
            }),
            None => emit(WatchEvent::Removed { path: original }),
        }
    });
}

/// 이벤트 처리 시점의 디스크 내용 해시·mtime. 읽기 실패(삭제·경합)는 None.
fn probe(path: &Path) -> Option<(u64, String)> {
    let bytes = std::fs::read(path).ok()?;
    let metadata = std::fs::metadata(path).ok()?;
    Some((mtime_millis(&metadata), content_hash(&bytes)))
}

fn watch_error(err: notify::Error) -> AppError {
    AppError::Io(format!("파일 감시를 시작할 수 없습니다: {err}"))
}

/// Tauri가 관리하는 감시 상태 — watch_paths 호출마다 전체 교체된다.
pub type SharedWatcher = Mutex<FileWatcher>;

/// file-changed 페이로드(→ rust-commands.md 이벤트 계약). hash는 이벤트 처리 시점의
/// 디스크 내용 해시 — 프론트 에코 억제의 기준값이다.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct FileChangedPayload {
    path: String,
    mtime: u64,
    hash: String,
}

/// file-removed 페이로드(→ rust-commands.md 이벤트 계약).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct FileRemovedPayload {
    path: String,
}

/// 감시 대상 해석 — 저장과 같은 해석(canonicalize, 없으면 부모 기준)을 쓴다: 삭제됐다
/// 재생성될 파일도 계속 감시해야 한다. 스코프 검증은 open/save와 동일한 원칙이다
/// (→ rust-commands.md#권한). 커맨드 밖에서 검증을 테스트하기 위해 분리한다.
fn resolve_watch_targets(
    scope: &FileScope,
    paths: Vec<String>,
) -> Result<HashMap<PathBuf, String>, AppError> {
    let mut targets = HashMap::new();
    for original in paths {
        let canonical = resolve_save_target(Path::new(&original))?;
        scope.ensure_allowed(&canonical)?;
        targets.insert(canonical, original);
    }
    Ok(targets)
}

#[tauri::command]
#[specta::specta]
pub async fn watch_paths(
    app: AppHandle,
    watcher: State<'_, SharedWatcher>,
    scope: State<'_, FileScope>,
    paths: Vec<String>,
) -> Result<(), AppError> {
    let targets = resolve_watch_targets(&scope, paths)?;
    watcher
        .lock()
        .expect("SharedWatcher는 포이즌되지 않는다")
        .replace(targets, move |event| emit_watch_event(&app, event))
}

fn emit_watch_event(app: &AppHandle, event: WatchEvent) {
    let result = match event {
        WatchEvent::Changed { path, mtime, hash } => {
            app.emit("file-changed", FileChangedPayload { path, mtime, hash })
        }
        WatchEvent::Removed { path } => app.emit("file-removed", FileRemovedPayload { path }),
    };
    if let Err(error) = result {
        // 이벤트 유실은 치명적이지 않다 — 저장 직전 해시 검사가 마지막 방어선이다
        // (→ file-lifecycle.md#저장-원자성과-충돌-검사).
        log::warn!("watch 이벤트 emit 실패: {error}");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::sync::mpsc;

    /// FSEvents 구독이 붙기까지의 여유 — 이 전에 일어난 변경은 이벤트가 없을 수 있다.
    const SUBSCRIBE_SETTLE: Duration = Duration::from_millis(300);
    /// 이벤트 수신 대기 상한 — 느린 머신에서도 견디게 넉넉히 잡는다.
    const RECV_TIMEOUT: Duration = Duration::from_secs(3);

    fn watch_single(watcher: &mut FileWatcher, path: &Path) -> mpsc::Receiver<WatchEvent> {
        let (tx, rx) = mpsc::channel();
        let mut targets = HashMap::new();
        targets.insert(
            fs::canonicalize(path).unwrap(),
            path.to_string_lossy().into_owned(),
        );
        watcher
            .replace(targets, move |event| {
                let _ = tx.send(event);
            })
            .unwrap();
        std::thread::sleep(SUBSCRIBE_SETTLE);
        rx
    }

    /// 수신 이벤트에서 조건을 만족하는 것이 나올 때까지 기다린다. Removed가 나오면 안 되는
    /// 시나리오는 호출부가 이벤트를 직접 검사한다.
    fn wait_for(
        rx: &mpsc::Receiver<WatchEvent>,
        mut accept: impl FnMut(&WatchEvent) -> bool,
    ) -> WatchEvent {
        let deadline = std::time::Instant::now() + RECV_TIMEOUT;
        loop {
            let remaining = deadline
                .checked_duration_since(std::time::Instant::now())
                .expect("기다리던 이벤트가 시간 안에 오지 않았다");
            let event = rx.recv_timeout(remaining).expect("이벤트 수신 실패");
            if accept(&event) {
                return event;
            }
        }
    }

    // 집행: rust-commands.md watch_paths + 이벤트 계약 — "외부에서 파일이 수정됨.
    //       hash는 이벤트 처리 시점의 디스크 내용 해시".
    // 왜: 이 해시가 프론트 에코 억제(lastSavedHash 비교)의 기준값이다 — 틀리면 자기 저장을
    //     외부 변경으로 오판해 저장할 때마다 충돌 안내가 뜬다.
    // 보장: 외부 수정 시 file-changed에 "그 시점 디스크 내용"의 해시가 실려 온다.
    // 경계: 프론트의 억제·리로드 판단 자체는 프론트 테스트(단위 5) 소관.
    #[test]
    fn 외부_수정은_변경_시점_해시를_담은_changed_를_알린다() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("doc.md");
        fs::write(&path, "원본\n").unwrap();
        let mut watcher = FileWatcher::default();
        let rx = watch_single(&mut watcher, &path);

        fs::write(&path, "외부 수정\n").unwrap();

        let expected_hash = content_hash("외부 수정\n".as_bytes());
        let event = wait_for(
            &rx,
            |event| matches!(event, WatchEvent::Changed { hash, .. } if *hash == expected_hash),
        );
        match event {
            WatchEvent::Changed {
                path: event_path, ..
            } => {
                assert_eq!(event_path, path.to_string_lossy());
            }
            WatchEvent::Removed { .. } => unreachable!(),
        }
    }

    // 집행: rust-commands.md watch_paths — "삭제 감지는 짧은 유예(100ms) 후 존재를 재확인 —
    //       다시 존재하면 file-changed"(원자적 저장의 순간 삭제를 삭제로 오판하지 않음).
    // 왜: 외부 에디터 대부분이 임시 파일 + rename으로 저장한다 — 이걸 삭제로 알리면
    //     저장할 때마다 프론트가 "파일이 삭제됨" 오경보를 띄운다.
    // 보장: 삭제 직후 재생성(rename 교체 재현)은 Removed 없이 Changed로만 알려진다.
    // 경계: 유예(100ms)를 넘겨 재생성되면 Removed 후 Changed가 올 수 있다 — 계약된 한계.
    #[test]
    fn 원자적_교체는_삭제가_아니라_변경으로_알린다() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("doc.md");
        fs::write(&path, "원본\n").unwrap();
        let mut watcher = FileWatcher::default();
        let rx = watch_single(&mut watcher, &path);

        // 외부 에디터의 원자적 저장 재현 — 같은 디렉터리의 임시 파일을 rename으로 교체.
        let temp = dir.path().join("doc.md.tmp");
        fs::write(&temp, "교체본\n").unwrap();
        fs::rename(&temp, &path).unwrap();

        let expected_hash = content_hash("교체본\n".as_bytes());
        wait_for(&rx, |event| {
            assert!(
                !matches!(event, WatchEvent::Removed { .. }),
                "원자적 교체가 삭제로 오판됐다"
            );
            matches!(event, WatchEvent::Changed { hash, .. } if *hash == expected_hash)
        });
    }

    // 집행: rust-commands.md watch_paths — "정말 없으면 그때 file-removed" + 이벤트 계약.
    // 왜: 진짜 삭제를 알리지 못하면 프론트가 "저장 시 새로 생성" 선택을 안내할 수 없다.
    // 보장: 유예(100ms) 후에도 없는 파일은 file-removed로 알려진다.
    // 경계: 탭 표시·재생성 선택 UI는 프론트(단위 5) 소관.
    #[test]
    fn 진짜_삭제는_유예_후_removed_를_알린다() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("doc.md");
        fs::write(&path, "원본\n").unwrap();
        let mut watcher = FileWatcher::default();
        let rx = watch_single(&mut watcher, &path);

        fs::remove_file(&path).unwrap();

        let event = wait_for(&rx, |event| matches!(event, WatchEvent::Removed { .. }));
        assert_eq!(
            event,
            WatchEvent::Removed {
                path: path.to_string_lossy().into_owned()
            }
        );
    }

    // 집행: rust-commands.md#권한-capabilities — 감시도 open/save와 같은 커맨드 내부 스코프
    //       검증을 거친다.
    // 왜: 감시는 파일 내용 해시를 이벤트로 내보낸다 — 허용 루트 밖 경로가 통과하면 웹뷰가
    //     보호 구역 밖 파일의 변경·존재를 관찰할 수 있다. 기존 테스트는 코어(replace)만 타서
    //     이 검증의 회귀를 잡지 못했다(리뷰 지적).
    // 보장: 허용 루트 밖 경로의 감시 선언은 Permission으로 거부된다.
    // 경계: 이벤트 발생 시점의 심볼릭 링크 재검증은 후속 단위에서 다룬다(해시 노출 수준).
    #[test]
    fn 허용_루트_밖_경로의_감시_선언은_거부된다() {
        let dir = tempfile::tempdir().unwrap();
        let scope = crate::scope::FileScope::default();
        scope.allow(fs::canonicalize(dir.path()).unwrap());
        let outside = tempfile::tempdir().unwrap();
        let secret = outside.path().join("secret.md");
        fs::write(&secret, "밖\n").unwrap();

        let result = resolve_watch_targets(&scope, vec![secret.to_string_lossy().into_owned()]);
        assert!(matches!(result, Err(AppError::Permission(_))));
    }

    // 집행: rust-commands.md watch_paths — "감시 대상 전체를 선언적으로 교체한다(누적 아님) —
    //       호출 시 이전 감시는 모두 해제".
    // 왜: 해제가 누락되면 닫은 탭의 파일이 계속 감시되어 유령 이벤트·자원 누수가 쌓인다.
    // 보장: replace 후 이전 대상의 변경은 이벤트를 만들지 않고(구독 해제로 채널이 끊긴다),
    //       새 대상의 변경만 알려진다.
    // 경계: 같은 파일을 두 번 선언하는 중복은 HashMap 키가 흡수한다 — 별도로 다루지 않는다.
    #[test]
    fn replace_는_이전_감시를_모두_해제하고_새_대상만_본다() {
        let dir = tempfile::tempdir().unwrap();
        let old = dir.path().join("old.md");
        let new = dir.path().join("new.md");
        fs::write(&old, "옛 파일\n").unwrap();
        fs::write(&new, "새 파일\n").unwrap();

        let mut watcher = FileWatcher::default();
        let old_rx = watch_single(&mut watcher, &old);
        let new_rx = watch_single(&mut watcher, &new); // 두 번째 replace — old 감시 해제.

        fs::write(&old, "옛 파일 수정\n").unwrap();
        fs::write(&new, "새 파일 수정\n").unwrap();

        let expected_hash = content_hash("새 파일 수정\n".as_bytes());
        wait_for(
            &new_rx,
            |event| matches!(event, WatchEvent::Changed { hash, .. } if *hash == expected_hash),
        );
        // 이전 구독은 콜백째 드롭됐다 — 송신자가 사라져 채널이 끊긴 것이 해제의 증거다.
        // 드롭은 감시 백엔드 스레드에서 비동기로 끝나므로 시한부로 기다린다(즉시 단언은 플레이크).
        // 채널에는 교체 "전"에 배달된 정당한 이벤트(셋업의 파일 생성 등)가 남아 있을 수
        // 있다 — 유출의 증거는 교체 "후" 수정본의 해시를 담은 이벤트뿐이므로 그것만 금지한다.
        let leaked_hash = content_hash("옛 파일 수정\n".as_bytes());
        let deadline = std::time::Instant::now() + RECV_TIMEOUT;
        loop {
            match old_rx.try_recv() {
                Err(mpsc::TryRecvError::Disconnected) => break,
                Err(mpsc::TryRecvError::Empty) => {
                    assert!(
                        std::time::Instant::now() < deadline,
                        "이전 감시가 해제되지 않았다(채널이 살아 있음)"
                    );
                    std::thread::sleep(Duration::from_millis(10));
                }
                Ok(WatchEvent::Changed { hash, .. }) if hash == leaked_hash => {
                    panic!("해제된 감시가 교체 후의 수정을 알렸다")
                }
                Ok(_) => {} // 교체 전에 배달된 이벤트 — 유출이 아니다.
            }
        }
    }
}
