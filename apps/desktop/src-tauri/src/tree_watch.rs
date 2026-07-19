//! 트리(폴더) 외부 변경 감시(watch_tree) — 계약의 단일 출처: .claude/docs/rust-commands.md.
//! 프론트의 반영 정책(읽어 둔 폴더만 재읽기·병합)은 document-model.md#파일-트리-사이드바가
//! 단일 출처다. 열린 파일의 감시(watch.rs)와 별개 감시다 — 저쪽은 파일 내용, 여기는
//! 디렉터리 "목록 구성"의 변화만 다룬다.

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use notify::event::{EventKind, ModifyKind};
use notify::{RecursiveMode, Watcher};
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::error::AppError;
use crate::scope::FileScope;

/// 코얼레싱 창 — 같은 디렉터리의 연속 이벤트를 이 시간 동안 하나로 합친다
/// (→ rust-commands.md watch_tree). 알림당 프론트가 read_dir 재읽기를 하므로,
/// git checkout류 대량 변경이 재읽기를 증폭시키지 않게 파일 감시(50ms)보다 넓게 잡는다.
const COALESCE_WINDOW: Duration = Duration::from_millis(200);

/// 디렉터리별 알림 예약 게이트 — 이미 예약된 디렉터리의 추가 이벤트를 합친다.
#[derive(Default, Clone)]
struct NotifyGate {
    scheduled: Arc<Mutex<HashSet<PathBuf>>>,
}

impl NotifyGate {
    fn try_schedule(&self, dir: &Path) -> bool {
        self.scheduled
            .lock()
            .expect("NotifyGate는 포이즌되지 않는다")
            .insert(dir.to_path_buf())
    }

    fn release(&self, dir: &Path) {
        self.scheduled
            .lock()
            .expect("NotifyGate는 포이즌되지 않는다")
            .remove(dir);
    }
}

/// 트리 감시 코어 — 선언적 교체만 제공한다. Tauri 없이 실제 파일시스템으로 테스트한다.
#[derive(Default)]
pub struct TreeWatcher {
    /// Some = 감시 중. 교체 시 드롭되면서 이전 구독이 해제된다.
    inner: Option<notify::RecommendedWatcher>,
    /// 세대 토큰 — 감시 해제가 비동기인 백엔드(FSEvents)에서 이전 구독의 늦은 이벤트를
    /// 버리기 위한 장치(watch.rs와 동일 전략).
    generation: Arc<AtomicU64>,
}

impl TreeWatcher {
    /// 감시 루트를 교체한다(None = 해제). `root`는 canonicalize된 경로여야 한다 —
    /// 이벤트의 dir가 canonical 기준이 되어 프론트 트리 노드 경로와 그대로 대조된다.
    pub fn replace(
        &mut self,
        root: Option<PathBuf>,
        on_dir_changed: impl Fn(String) + Send + Sync + 'static,
    ) -> Result<(), AppError> {
        // 새 세대 토큰 — 커밋(교체 성공) 시점에만 전역 반영한다(watch.rs와 동일 계약:
        // 준비 실패가 무감시 상태를 남기지 않는다).
        let token = self.generation.load(Ordering::SeqCst) + 1;
        let Some(root) = root else {
            self.generation.store(token, Ordering::SeqCst);
            self.inner = None;
            return Ok(());
        };

        let on_dir_changed: Arc<dyn Fn(String) + Send + Sync> = Arc::new(on_dir_changed);
        let generation = Arc::clone(&self.generation);
        let gate = NotifyGate::default();
        let notify_queue = spawn_notify_worker(
            Arc::clone(&on_dir_changed),
            Arc::clone(&generation),
            token,
            gate.clone(),
        )?;
        let callback_root = root.clone();
        let mut watcher =
            notify::recommended_watcher(move |result: notify::Result<notify::Event>| {
                // 낡은 세대(교체 전 구독)의 늦은 이벤트는 버린다.
                if generation.load(Ordering::SeqCst) != token {
                    return;
                }
                // 감시 백엔드 에러(큐 넘침 등)는 무시한다 — 놓친 변경은 다음 이벤트나
                // 폴더 펼침(read_dir)이 보정한다.
                let Ok(event) = result else { return };
                if !changes_listing(&event.kind) {
                    return;
                }
                for path in &event.paths {
                    if passes_hidden_component(&callback_root, path) {
                        continue;
                    }
                    // 변경 항목의 부모가 곧 "구성이 바뀐 목록"이다. 루트 밖은 알리지 않는다.
                    let Some(parent) = path.parent() else {
                        continue;
                    };
                    if !parent.starts_with(&callback_root) {
                        continue;
                    }
                    // 코얼레싱 — 알림이 이미 예약된 디렉터리의 연속 이벤트는 합친다.
                    if !gate.try_schedule(parent) {
                        continue;
                    }
                    let due = std::time::Instant::now() + COALESCE_WINDOW;
                    if notify_queue.send((parent.to_path_buf(), due)).is_err() {
                        // 워커가 죽었다(비정상) — 게이트를 되돌려 이 디렉터리의 이후
                        // 알림이 영구 차단되지 않게 한다.
                        gate.release(parent);
                    }
                }
            })
            .map_err(watch_error)?;
        watcher
            .watch(&root, RecursiveMode::Recursive)
            .map_err(watch_error)?;

        // 커밋 — 새 감시가 준비된 뒤에만 세대를 올리고 이전 감시를 교체한다.
        self.generation.store(token, Ordering::SeqCst);
        self.inner = Some(watcher);
        Ok(())
    }
}

/// 단일 알림 워커 — 감시당 스레드 하나가 (디렉터리, 만기) 큐를 순서대로 소비한다.
/// 알림마다 스레드를 만들면 대량 변경(압축 해제·git checkout) 시 바뀐 디렉터리 수만큼
/// 스레드가 생기고, notify 콜백 안의 생성 실패 패닉이 감시를 죽일 수 있다.
/// 만기는 전부 "지금 + 같은 창"이라 큐가 곧 시간순이다 — 워커는 앞에서부터 자며 소비한다.
/// notify 콜백 스레드에서 자지 않는 것은 기존과 동일(후속 이벤트가 밀리지 않게).
/// 워커는 발신 직전에 게이트를 해제하고(창 밖 변경이 새 알림을 예약할 수 있게) 세대를
/// 재검사한다(교체됐으면 발신하지 않음). 송신자가 모두 드롭되면(감시 교체) 스스로 끝난다.
fn spawn_notify_worker(
    on_dir_changed: Arc<dyn Fn(String) + Send + Sync>,
    generation: Arc<AtomicU64>,
    token: u64,
    gate: NotifyGate,
) -> Result<std::sync::mpsc::Sender<(PathBuf, std::time::Instant)>, AppError> {
    let (sender, receiver) = std::sync::mpsc::channel::<(PathBuf, std::time::Instant)>();
    std::thread::Builder::new()
        .name("norii-tree-notify".into())
        .spawn(move || {
            while let Ok((dir, due)) = receiver.recv() {
                let wait = due.saturating_duration_since(std::time::Instant::now());
                if !wait.is_zero() {
                    std::thread::sleep(wait);
                }
                gate.release(&dir);
                if generation.load(Ordering::SeqCst) == token {
                    on_dir_changed(dir.to_string_lossy().into_owned());
                }
            }
        })
        .map_err(|err| AppError::Io(format!("폴더 감시 워커를 시작할 수 없습니다: {err}")))?;
    Ok(sender)
}

fn watch_error(err: notify::Error) -> AppError {
    AppError::Io(format!("폴더 감시를 시작할 수 없습니다: {err}"))
}

/// 목록 구성이 바뀔 수 있는 사건만 남긴다 — 파일 내용 수정·접근은 목록과 무관하다
/// (→ rust-commands.md watch_tree). 분류 불명(Any/Other)은 보수적으로 알린다.
fn changes_listing(kind: &EventKind) -> bool {
    match kind {
        EventKind::Create(_) | EventKind::Remove(_) => true,
        EventKind::Modify(ModifyKind::Name(_)) => true,
        EventKind::Modify(_) | EventKind::Access(_) => false,
        _ => true,
    }
}

/// 루트 "아래"에서 숨김 컴포넌트('.' 시작)를 지나는 경로인가 — 그 이벤트는 무시한다.
/// 루트 자신의 경로 컴포넌트는 검사하지 않는다(숨김 폴더를 루트로 여는 것은 허용).
fn passes_hidden_component(root: &Path, path: &Path) -> bool {
    let Ok(relative) = path.strip_prefix(root) else {
        return false;
    };
    relative.components().any(|component| {
        component
            .as_os_str()
            .to_str()
            .is_some_and(|name| name.starts_with('.'))
    })
}

/// Tauri가 관리하는 트리 감시 상태 — watch_tree 호출마다 전체 교체된다.
pub type SharedTreeWatcher = Mutex<TreeWatcher>;

/// dir-changed 페이로드(→ rust-commands.md 이벤트 계약).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DirChangedPayload {
    dir: String,
}

#[tauri::command]
#[specta::specta]
pub async fn watch_tree(
    app: AppHandle,
    watcher: State<'_, SharedTreeWatcher>,
    scope: State<'_, FileScope>,
    root: Option<String>,
) -> Result<(), AppError> {
    let canonical = match root {
        Some(ref requested) => {
            let canonical = std::fs::canonicalize(requested)?;
            scope.ensure_allowed(&canonical)?;
            Some(canonical)
        }
        None => None,
    };
    watcher
        .lock()
        .expect("SharedTreeWatcher는 포이즌되지 않는다")
        .replace(canonical, move |dir| {
            if let Err(error) = app.emit("dir-changed", DirChangedPayload { dir }) {
                // 알림 유실은 치명적이지 않다 — 다음 이벤트나 폴더 펼침이 최신을 읽는다.
                log::warn!("dir-changed emit 실패: {error}");
            }
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::sync::mpsc;

    /// 이벤트 수신 대기 상한 — FSEvents 지연 + 코얼레싱 창을 여유 있게 덮는다.
    const RECV_TIMEOUT: Duration = Duration::from_secs(3);

    fn watch_root(watcher: &mut TreeWatcher, root: &Path) -> mpsc::Receiver<String> {
        let (sender, receiver) = mpsc::channel::<String>();
        watcher
            .replace(Some(root.to_path_buf()), move |dir| {
                let _ = sender.send(dir);
            })
            .expect("트리 감시 시작");
        receiver
    }

    fn canonical_tempdir() -> (tempfile::TempDir, PathBuf) {
        let dir = tempfile::tempdir().expect("임시 디렉터리");
        let canonical = fs::canonicalize(dir.path()).expect("canonicalize");
        (dir, canonical)
    }

    /// 기대 디렉터리 알림이 올 때까지 수신한다 — FSEvents는 구독 직전의 과거 이벤트를
    /// 재생할 수 있어(실측: 감시 전 만든 폴더의 생성 이벤트가 도착) 첫 수신만 단정하면
    /// 순서에 따라 흔들린다. 기한 내 도착 여부만 계약으로 고정한다.
    fn recv_until(receiver: &mpsc::Receiver<String>, expected: &Path) -> bool {
        let deadline = std::time::Instant::now() + RECV_TIMEOUT;
        while let Ok(dir) =
            receiver.recv_timeout(deadline.saturating_duration_since(std::time::Instant::now()))
        {
            if dir == expected.to_str().unwrap() {
                return true;
            }
        }
        false
    }

    // 집행: rust-commands.md watch_tree — "dir-changed { dir }: 변경 항목의 부모 디렉터리".
    // 왜: 이 이벤트가 없으면 밖(파인더 등)에서 만든 파일이 트리에 나타나지 않는다 —
    //     사용자 결정(안 C: 감시 자동 반영)의 핵심 배선이다.
    // 보장: 루트에 파일이 생기면 루트 경로가, 하위 폴더 안에 생기면 그 폴더 경로가
    //       canonical 기준으로 알려진다.
    // 경계: 프론트의 재읽기·병합은 프론트 테스트 소관.
    #[test]
    fn 파일_생성은_부모_디렉터리를_알린다() {
        let (_dir, root) = canonical_tempdir();
        let sub = root.join("notes");
        fs::create_dir(&sub).unwrap();
        let mut watcher = TreeWatcher::default();
        let receiver = watch_root(&mut watcher, &root);

        fs::write(sub.join("new.md"), "").unwrap();

        assert!(
            recv_until(&receiver, &sub),
            "하위 폴더의 dir-changed 미수신"
        );
    }

    // 집행: rust-commands.md watch_tree — 숨김 컴포넌트를 지나는 이벤트 무시.
    // 왜: .git 내부는 커밋 한 번에 수백 이벤트를 만든다 — 트리는 숨김 항목을 표시하지
    //     않으므로(read_dir 필터) 목록 구성 변화도 아니다.
    // 보장: 숨김 폴더 아래 변경은 알리지 않고, 이후 일반 변경은 정상 수신된다(감시 생존).
    // 경계: 숨김 "파일" 자체의 생성(루트 직하 .DS_Store)도 같은 규칙으로 걸러진다.
    #[test]
    fn 숨김_디렉터리_아래는_알리지_않는다() {
        let (_dir, root) = canonical_tempdir();
        let git = root.join(".git");
        fs::create_dir(&git).unwrap();
        let mut watcher = TreeWatcher::default();
        let receiver = watch_root(&mut watcher, &root);

        fs::write(git.join("index.lock"), "").unwrap();
        fs::write(root.join(".DS_Store"), "").unwrap();
        // 대조군 — 이어지는 일반 변경은 수신돼야 한다(무시가 감시 중단이 아님을 함께 고정).
        fs::write(root.join("visible.md"), "").unwrap();

        let dir = receiver
            .recv_timeout(RECV_TIMEOUT)
            .expect("dir-changed 수신");
        assert_eq!(dir, root.to_str().unwrap());
        // 숨김 이벤트가 별도로 오지 않았는지 — 짧은 창을 더 기다려 확인한다.
        assert!(receiver.recv_timeout(Duration::from_millis(400)).is_err());
    }

    // 집행: rust-commands.md watch_tree — "같은 dir의 연속 이벤트는 창(200ms)으로 합친다".
    // 왜: 알림당 프론트가 read_dir를 다시 부른다 — 대량 변경(압축 해제·git checkout)이
    //     이벤트 수만큼 재읽기를 만들면 성능 규칙이 깨진다.
    // 보장: 창 안의 연속 생성 N개가 같은 dir 알림 1회로 합쳐진다.
    // 경계: 창 밖의 후속 변경이 다시 알려지는 것은 정상이다(합침은 유실이 아니다).
    #[test]
    fn 같은_디렉터리의_연속_이벤트는_한_번으로_합쳐진다() {
        let (_dir, root) = canonical_tempdir();
        let mut watcher = TreeWatcher::default();
        let receiver = watch_root(&mut watcher, &root);

        for index in 0..5 {
            fs::write(root.join(format!("{index}.md")), "").unwrap();
        }

        let dir = receiver
            .recv_timeout(RECV_TIMEOUT)
            .expect("dir-changed 수신");
        assert_eq!(dir, root.to_str().unwrap());
        // 코얼레싱 창 + 여유를 기다려도 추가 알림이 없어야 한다.
        assert!(receiver.recv_timeout(Duration::from_millis(600)).is_err());
    }

    // 왜: 알림 배달이 단일 워커 큐로 바뀌었다 — 여러 디렉터리가 한꺼번에 바뀔 때
    //     워커 하나가 큐를 끝까지 소진하지 못하면 일부 폴더의 변경이 유실된다.
    // 보장: 서로 다른 디렉터리 20곳의 변경 알림이 모두 기한 내 도착한다.
    // 경계: 스레드 수 자체(1개)는 구현 세부라 단정하지 않는다 — 소진 동작만 고정한다.
    #[test]
    fn 여러_디렉터리의_변경이_모두_알려진다() {
        let (_dir, root) = canonical_tempdir();
        let subs: Vec<PathBuf> = (0..20)
            .map(|index| root.join(format!("d{index}")))
            .collect();
        for sub in &subs {
            fs::create_dir(sub).unwrap();
        }
        let mut watcher = TreeWatcher::default();
        let receiver = watch_root(&mut watcher, &root);

        for sub in &subs {
            fs::write(sub.join("x.md"), "").unwrap();
        }

        let mut pending: std::collections::HashSet<PathBuf> = subs.iter().cloned().collect();
        let deadline = std::time::Instant::now() + Duration::from_secs(10);
        while !pending.is_empty() {
            let remaining = deadline.saturating_duration_since(std::time::Instant::now());
            let Ok(dir) = receiver.recv_timeout(remaining) else {
                break;
            };
            pending.remove(Path::new(&dir));
        }
        assert!(pending.is_empty(), "미수신 디렉터리: {pending:?}");
    }

    // 집행: rust-commands.md watch_tree — "None = 감시 해제"·선언적 교체.
    // 왜: 폴더를 바꿔 열면 이전 루트의 이벤트가 새 트리를 오염시키면 안 된다.
    // 보장: 해제 후의 변경은 알려지지 않는다.
    // 경계: 교체 실패 시 이전 감시 유지(무감시 창 없음)는 구현 계약 — 여기서는 해제만 고정.
    #[test]
    fn 해제하면_더_이상_알리지_않는다() {
        let (_dir, root) = canonical_tempdir();
        let mut watcher = TreeWatcher::default();
        let receiver = watch_root(&mut watcher, &root);

        watcher.replace(None, |_| {}).expect("감시 해제");
        fs::write(root.join("after.md"), "").unwrap();

        assert!(receiver.recv_timeout(Duration::from_millis(600)).is_err());
    }
}
