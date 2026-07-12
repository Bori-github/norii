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

/// 코얼레싱 창 — 같은 경로의 연속 이벤트를 이 시간 동안 하나의 확인으로 합친다
/// (→ rust-commands.md watch_paths 이벤트 코얼레싱). 확인은 파일 전체 읽기+해시라,
/// 외부 도구의 연속 쓰기가 읽기를 증폭시키지 않게 한다.
const COALESCE_WINDOW: Duration = Duration::from_millis(50);

/// 경로별 확인(probe) 예약 게이트 — 확인이 이미 예약된 경로의 추가 이벤트를 합친다.
#[derive(Default, Clone)]
struct ProbeGate {
    scheduled: Arc<Mutex<HashSet<PathBuf>>>,
}

impl ProbeGate {
    /// 이 경로의 확인을 예약해도 되는가 — 이미 예약돼 있으면 false(이벤트가 합쳐진다).
    fn try_schedule(&self, path: &Path) -> bool {
        self.scheduled
            .lock()
            .expect("ProbeGate는 포이즌되지 않는다")
            .insert(path.to_path_buf())
    }

    /// 디스크를 읽기 직전에 해제한다 — 해제 후 도착한 이벤트는 새 확인을 예약하므로
    /// 읽기와 겹친 마지막 변경도 놓치지 않는다.
    fn release(&self, path: &Path) {
        self.scheduled
            .lock()
            .expect("ProbeGate는 포이즌되지 않는다")
            .remove(path);
    }
}

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
    /// 반환값은 구독 실패로 감시되지 않은 대상 수다(→ rust-commands.md — 프론트 재시도 근거).
    pub fn replace(
        &mut self,
        targets: HashMap<PathBuf, String>,
        on_event: impl Fn(WatchEvent) + Send + Sync + 'static,
    ) -> Result<u32, AppError> {
        // 새 세대 토큰 — 커밋(교체 성공) 시점에만 전역에 반영한다. 새 감시 준비가 실패하면
        // 세대·이전 감시가 그대로 남아 무감시 상태가 생기지 않는다(→ rust-commands.md).
        let token = self.generation.load(Ordering::SeqCst) + 1;
        if targets.is_empty() {
            // 빈 선언 — 이전 감시 해제가 곧 목표 상태다.
            self.generation.store(token, Ordering::SeqCst);
            self.inner = None;
            return Ok(0);
        }

        // 부모 디렉터리를 감시하고 경로로 필터한다(계약). 같은 폴더의 파일들은 구독 하나를 공유한다.
        let dirs: HashSet<PathBuf> = targets
            .keys()
            .filter_map(|path| path.parent().map(Path::to_path_buf))
            .collect();

        let targets = Arc::new(targets);
        // 클로저로 이동하기 전에 집계용 참조를 확보한다(구독 실패 대상 수 계산).
        let targets_for_count = Arc::clone(&targets);
        let on_event: Arc<dyn Fn(WatchEvent) + Send + Sync> = Arc::new(on_event);
        let generation = Arc::clone(&self.generation);
        let gate = ProbeGate::default();
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
                        // 코얼레싱 — 확인이 이미 예약된 경로의 연속 이벤트는 합친다.
                        if !gate.try_schedule(event_path) {
                            continue;
                        }
                        probe_and_notify(
                            event_path.clone(),
                            original.clone(),
                            Arc::clone(&on_event),
                            Arc::clone(&generation),
                            token,
                            gate.clone(),
                        );
                    }
                }
            })
            .map_err(watch_error)?;

        // 구독 — 실패한 디렉터리는 건너뛴다(부분 실패 허용, → rust-commands.md). 탭 하나의
        // 사정(부모 삭제 등)이 나머지 탭의 감시까지 죽이면 안 된다.
        let mut failed_dirs: HashSet<PathBuf> = HashSet::new();
        for dir in &dirs {
            if let Err(error) = watcher.watch(dir, RecursiveMode::NonRecursive) {
                log::warn!("감시 구독 건너뜀({}): {error}", dir.display());
                failed_dirs.insert(dir.clone());
            }
        }
        // 구독 실패로 감시되지 않은 대상 수 — 프론트가 재시도 여부를 정하는 근거다.
        let skipped = targets_for_count
            .keys()
            .filter(|path| {
                path.parent()
                    .is_some_and(|parent| failed_dirs.contains(parent))
            })
            .count() as u32;

        // 커밋 — 새 감시가 준비된 뒤에만 세대를 올리고 이전 감시를 교체한다.
        self.generation.store(token, Ordering::SeqCst);
        self.inner = Some(watcher);
        Ok(skipped)
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
    gate: ProbeGate,
) {
    std::thread::spawn(move || {
        // 코얼레싱 창 — 이 사이 도착한 같은 경로의 이벤트는 게이트가 합친다. 창이 끝나면
        // 게이트를 해제하고 읽는다 — 읽기와 겹친 새 이벤트는 새 확인을 예약하므로 안전하다.
        std::thread::sleep(COALESCE_WINDOW);
        gate.release(&path);
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
/// 반환은 (대상 맵, 해석 실패로 건너뛴 수) — 건너뜀은 프론트 재시도의 근거다.
fn resolve_watch_targets(
    scope: &FileScope,
    paths: Vec<String>,
) -> Result<(HashMap<PathBuf, String>, u32), AppError> {
    let mut targets = HashMap::new();
    let mut skipped: u32 = 0;
    for original in paths {
        let canonical = match resolve_save_target(Path::new(&original)) {
            Ok(canonical) => canonical,
            Err(error) => {
                // 부분 실패 허용 — 탭 하나의 사정(부모 삭제 등)이 전체 감시를 죽이면 안 된다
                // (→ rust-commands.md watch_paths).
                log::warn!("감시 경로 건너뜀({original}): {error}");
                skipped += 1;
                continue;
            }
        };
        // 해석이 성공한 경로의 스코프 위반은 전체를 거부한다 — 보안 신호다(→ rust-commands.md).
        scope.ensure_allowed(&canonical)?;
        targets.insert(canonical, original);
    }
    Ok((targets, skipped))
}

#[tauri::command]
#[specta::specta]
pub async fn watch_paths(
    app: AppHandle,
    watcher: State<'_, SharedWatcher>,
    scope: State<'_, FileScope>,
    paths: Vec<String>,
) -> Result<u32, AppError> {
    let (targets, resolve_skipped) = resolve_watch_targets(&scope, paths)?;
    let subscribe_skipped = watcher
        .lock()
        .expect("SharedWatcher는 포이즌되지 않는다")
        .replace(targets, move |event| emit_watch_event(&app, event))?;
    Ok(resolve_skipped + subscribe_skipped)
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

    // 집행: rust-commands.md watch_paths — "부분 실패 허용: 해석·구독에 실패한 경로는
    //       건너뛰고 나머지를 감시한다…단, 스코프 위반은 전체를 거부".
    // 왜: 탭 하나의 부모 폴더가 밖에서 지워지면 전체 재선언이 실패해 모든 탭의 외부 변경
    //     감지가 조용히 죽는다(리뷰 P2 — 전부 아니면 전무).
    // 보장: 해석 불가 경로(부모 없음)는 건너뛰고 나머지가 감시 대상에 남는다.
    //       스코프 위반은 여전히 전체 Permission 거부다(기존 테스트가 고정).
    // 경계: 건너뛴 경로의 로그 내용은 검증하지 않는다.
    #[test]
    fn 해석_실패_경로는_건너뛰고_나머지를_해석하며_건너뜀_수를_센다() {
        let dir = tempfile::tempdir().unwrap();
        let scope = crate::scope::FileScope::default();
        scope.allow(fs::canonicalize(dir.path()).unwrap());
        let good = dir.path().join("good.md");
        fs::write(&good, "정상\n").unwrap();
        // 부모 디렉터리가 존재하지 않는 경로 — canonicalize가 실패한다.
        let orphan = dir.path().join("no-such-dir").join("orphan.md");

        let (targets, skipped) = resolve_watch_targets(
            &scope,
            vec![
                orphan.to_string_lossy().into_owned(),
                good.to_string_lossy().into_owned(),
            ],
        )
        .unwrap();

        assert_eq!(targets.len(), 1);
        assert_eq!(skipped, 1); // 프론트가 이 값으로 재시도 여부를 정한다(→ rust-commands.md).
        assert!(targets.values().any(|v| v.ends_with("good.md")));
    }

    // 집행: rust-commands.md watch_paths — "스코프 위반 판정은 해석이 성공한 경로에만
    //       가능하다 — 해석이 실패한 경로는 건너뜀으로 처리된다".
    // 왜: 부분 실패(가용성)와 스코프 거부(보안 신호)의 우선순위가 테스트로 고정되지 않으면,
    //     "허용 루트 밖 + 부모 없음" 경로의 판정이 구현 순서에 따라 조용히 뒤집힐 수 있다.
    // 보장: 해석 불가한 밖 경로는 Permission이 아니라 건너뜀이다(감시하지 않으므로
    //       스코프는 넓어지지 않는다) — 계약이 말하는 그대로.
    // 경계: 해석 가능한 밖 경로의 전체 거부는 기존 테스트가 고정한다.
    #[test]
    fn 허용_루트_밖이라도_해석_불가면_거부가_아니라_건너뜀이다() {
        let dir = tempfile::tempdir().unwrap();
        let scope = crate::scope::FileScope::default();
        scope.allow(fs::canonicalize(dir.path()).unwrap());
        let outside = tempfile::tempdir().unwrap();
        // 허용 루트 밖이면서 부모도 존재하지 않는 경로 — 해석 단계에서 실패한다.
        let unresolvable = outside.path().join("no-such-dir").join("ghost.md");

        let (targets, skipped) =
            resolve_watch_targets(&scope, vec![unresolvable.to_string_lossy().into_owned()])
                .unwrap();

        assert!(targets.is_empty());
        assert_eq!(skipped, 1);
    }

    // 집행: rust-commands.md watch_paths — 부분 실패 허용은 구독(디렉터리 watch) 실패에도
    //       적용된다 + "새 감시를 만든 뒤에만 이전 감시를 교체한다".
    // 왜: 구독 하나의 실패가 replace 전체를 중단시키면, 이미 버린 이전 감시 탓에 무감시
    //     상태가 남는다(리뷰 P2 — 교체 순서).
    // 보장: 존재하지 않는 디렉터리의 대상이 섞여 있어도 replace가 성공하고,
    //       정상 대상의 외부 수정은 계속 감지된다.
    // 경계: watcher 생성 자체(OS 자원)의 실패는 이식성 있는 재현이 없어 코드 순서로만 보장한다.
    #[test]
    fn 구독_실패_대상은_건너뛰고_나머지는_계속_감시된다() {
        let dir = tempfile::tempdir().unwrap();
        let good = dir.path().join("good.md");
        fs::write(&good, "정상\n").unwrap();

        let (tx, rx) = mpsc::channel();
        let mut targets = HashMap::new();
        targets.insert(
            fs::canonicalize(&good).unwrap(),
            good.to_string_lossy().into_owned(),
        );
        // 부모가 이미 사라진 대상 — canonical 키를 손으로 만든다(재선언 직전 폴더 삭제 재현).
        targets.insert(
            dir.path().join("ghost-dir").join("ghost.md"),
            "ghost.md".to_owned(),
        );

        let mut watcher = FileWatcher::default();
        let skipped = watcher
            .replace(targets, move |event| {
                let _ = tx.send(event);
            })
            .expect("구독 실패 대상이 있어도 replace는 성공해야 한다");
        assert_eq!(skipped, 1); // 구독 실패로 감시되지 않은 대상 수 — 프론트 재시도 근거.
        std::thread::sleep(SUBSCRIBE_SETTLE);

        fs::write(&good, "정상 수정\n").unwrap();
        let expected_hash = content_hash("정상 수정\n".as_bytes());
        wait_for(
            &rx,
            |event| matches!(event, WatchEvent::Changed { hash, .. } if *hash == expected_hash),
        );
    }

    // 집행: rust-commands.md watch_paths — 코얼레싱의 정합성 반쪽: 이벤트를 합치되 마지막
    //       변경은 반드시 반영돼야 한다(게이트를 읽기 직전에 해제하는 순서가 그 보장이다).
    // 왜: 게이트 단위 테스트는 release/read 순서가 뒤집혀도(마지막 쓰기 유실) 통과한다 —
    //     수렴 속성은 실제 파일시스템으로만 관찰된다(리뷰 지적).
    // 보장: 연속 쓰기 후 최종 내용의 해시를 담은 Changed가 결국 도착한다.
    // 경계: 몇 회로 합쳐지는지는 OS 배칭에 좌우돼 단언하지 않는다.
    #[test]
    fn 연속_쓰기가_합쳐져도_마지막_내용은_반드시_반영된다() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("doc.md");
        fs::write(&path, "0\n").unwrap();
        let mut watcher = FileWatcher::default();
        let rx = watch_single(&mut watcher, &path);

        for i in 1..=5 {
            fs::write(&path, format!("버전 {i}\n")).unwrap();
        }

        let final_hash = content_hash("버전 5\n".as_bytes());
        wait_for(
            &rx,
            |event| matches!(event, WatchEvent::Changed { hash, .. } if *hash == final_hash),
        );
    }

    // 집행: rust-commands.md watch_paths — 선언적 교체의 빈 선언: 모든 탭이 닫히면 이전
    //       감시 해제가 곧 목표 상태다(세대 무효화 + 구독 해제).
    // 왜: 이 분기에서 세대 올림이 빠지면 낡은 유예 스레드의 늦은 이벤트가 해제 후에도
    //     새어 나온다 — 프론트가 실제로 타는 경로(모든 탭 닫기)인데 미검증이었다(리뷰).
    // 보장: 빈 replace 후 이전 대상의 수정은 그 수정 내용의 이벤트를 만들지 않는다.
    // 경계: 교체 전에 배달된 정당한 이벤트(생성 등)는 유출이 아니다 — 기존 테스트와 동일 기준.
    #[test]
    fn 빈_선언은_이전_감시를_해제하고_늦은_이벤트도_새지_않는다() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("doc.md");
        fs::write(&path, "원본\n").unwrap();
        let mut watcher = FileWatcher::default();
        let rx = watch_single(&mut watcher, &path);

        watcher
            .replace(HashMap::new(), |_event: WatchEvent| {})
            .unwrap();
        fs::write(&path, "해제 후 수정\n").unwrap();

        let leaked_hash = content_hash("해제 후 수정\n".as_bytes());
        let deadline = std::time::Instant::now() + RECV_TIMEOUT;
        loop {
            match rx.try_recv() {
                Err(mpsc::TryRecvError::Disconnected) => break,
                Err(mpsc::TryRecvError::Empty) => {
                    assert!(
                        std::time::Instant::now() < deadline,
                        "이전 감시가 해제되지 않았다(채널이 살아 있음)"
                    );
                    std::thread::sleep(Duration::from_millis(10));
                }
                Ok(WatchEvent::Changed { hash, .. }) if hash == leaked_hash => {
                    panic!("빈 선언 후에도 이전 감시가 수정을 알렸다")
                }
                Ok(_) => {} // 교체 전에 배달된 이벤트 — 유출이 아니다.
            }
        }
    }

    // 집행: rust-commands.md watch_paths — "같은 경로의 연속 이벤트는 짧은 창(50ms)으로 합쳐
    //       1회만 확인한다"(이벤트 코얼레싱).
    // 왜: 확인은 파일 전체 읽기+해시라, 외부 도구의 연속 쓰기가 이벤트 수 × 파일 크기만큼
    //     읽기를 증폭시킨다(리뷰 P2 — 성능 규칙 위반).
    // 보장: 확인이 예약된 경로의 추가 이벤트는 새 확인을 만들지 않고, 확인이 소비된 뒤에야
    //       다시 예약된다(경로별 게이트의 결정론적 단위 검증).
    // 경계: 실제 이벤트 폭주의 종단 동작은 OS 배칭과 겹쳐 비결정적이라 여기서 다루지 않는다.
    #[test]
    fn 확인_게이트는_경로당_한_번만_예약을_허용한다() {
        let gate = ProbeGate::default();
        let path = PathBuf::from("/tmp/a.md");

        assert!(gate.try_schedule(&path)); // 첫 이벤트 — 예약.
        assert!(!gate.try_schedule(&path)); // 폭주 — 이미 예약됨, 합쳐진다.
        assert!(!gate.try_schedule(&path));
        assert!(gate.try_schedule(Path::new("/tmp/b.md"))); // 다른 경로는 독립.

        gate.release(&path); // 확인 스레드가 디스크를 읽기 직전 해제.
        assert!(gate.try_schedule(&path)); // 이후 이벤트는 다시 예약된다.
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
