//! 창 뒤 배경 흐림(유리) — macOS.
//!
//! macOS에는 **창 뒤를 흐리는 공개 API가 없다.** 선택지는 둘뿐이다:
//!   1. `NSVisualEffectView`(Tauri의 `windowEffects`) — 뒤를 비추는 게 아니라 **테마 색을 띤 서리 재질**을
//!      덧대는 것이다. 실측 결과 배경이 바뀌어도 색이 4~5밖에 변하지 않아 "유리"로 보이지 않았다.
//!   2. 윈도서버 비공개 API로 **창 뒤 실제 배경을 흐린다** — 바탕화면·다른 창이 그대로 비친다.
//!
//! norii는 2번을 쓴다. 웹뷰 투명 배경 때문에 이미 비공개 API 선을 넘었으므로(`macOSPrivateApi`)
//! 새로 잃는 것은 없다(→ .claude/docs/platform-strategy.md#배포-경로--app-store는-비목표).
//! 설정값·기본값의 단일 출처는 .claude/docs/design/window-chrome.md다.

use std::sync::Mutex;

use tauri::State;

/// 창 뒤 흐림 반경(px). 0이면 흐림 없음.
///
/// 값의 의미: 창이 투명한 만큼 뒤가 비치고, 그 비친 배경을 이 반경으로 흐린다.
pub const DEFAULT_BLUR_RADIUS: u32 = 30;

/// 설정 슬라이더의 위쪽 끝(→ window-chrome.md#계약--흐림-반경).
pub const MAX_BLUR_RADIUS: u32 = 100;

/// 지금 창에 걸린 반경. `setup`이 기본값을 걸므로 그 값으로 시작한다.
pub struct AppliedBlurRadius(Mutex<u32>);

impl Default for AppliedBlurRadius {
    fn default() -> Self {
        Self(Mutex::new(DEFAULT_BLUR_RADIUS))
    }
}

/// 요청 반경을 범위 안으로 자르고, 걸린 값과 달라질 때만 새 반경을 돌려준다.
fn resolve_blur_change(applied: &mut u32, requested: u32) -> Option<u32> {
    let radius = requested.min(MAX_BLUR_RADIUS);
    (radius != *applied).then(|| {
        *applied = radius;
        radius
    })
}

#[tauri::command]
#[specta::specta]
pub fn set_window_blur_radius(
    window: tauri::WebviewWindow,
    applied: State<'_, AppliedBlurRadius>,
    radius: u32,
) {
    let mut applied = applied
        .0
        .lock()
        .expect("AppliedBlurRadius는 포이즌되지 않는다");
    let previous = *applied;
    let Some(radius) = resolve_blur_change(&mut applied, radius) else {
        return;
    };
    // AppKit은 메인 스레드 전용이라 창의 스레드로 넘긴다. 넘기지 못했으면 화면은 아직
    // 이전 반경이므로 기억도 되돌린다 — 안 되돌리면 같은 값 요청이 조용히 무시된다.
    let target = window.clone();
    if window
        .run_on_main_thread(move || apply_window_glass(&target, radius))
        .is_err()
    {
        *applied = previous;
    }
}

#[cfg(target_os = "macos")]
mod platform {
    use std::ffi::{c_void, CStr};

    use objc2::msg_send;
    use objc2::runtime::AnyObject;
    use objc2::MainThreadMarker;

    // 비공개 심볼의 실제 시그니처. 창 번호는 32비트(CGSWindowID)다 — NSWindow의 windowNumber는
    // 64비트(NSInteger)이므로 좁히는 지점을 코드에 드러낸다.
    type MainConnectionId = unsafe extern "C" fn() -> i32;
    type SetBlurRadius = unsafe extern "C" fn(i32, u32, i32) -> i32;

    /// 비공개 심볼을 **실행 시점에** 찾는다. 없으면 `None`.
    ///
    /// `extern "C"`로 정적 링크하면 안 된다 — 심볼이 사라진 macOS에서 dyld가 바인딩에 실패해
    /// **앱이 기동조차 못 한다.** 장식 기능 하나가 앱 전체를 끌고 내려가는 셈이다. 이 심볼들은
    /// 실제로 위험하다: 이미 SkyLight로 옮겨갔고 CoreGraphics는 호환용으로 재수출만 하고 있다.
    /// 실행 시점에 찾으면 없을 때 유리만 조용히 꺼지고 앱은 뜬다.
    fn lookup(name: &CStr) -> Option<*mut c_void> {
        // SAFETY: AppKit이 이미 CoreGraphics를 프로세스에 올려 두었으므로 RTLD_DEFAULT로 찾는다.
        // dlsym은 못 찾으면 널을 돌려줄 뿐 프로세스를 건드리지 않는다.
        let symbol = unsafe { libc::dlsym(libc::RTLD_DEFAULT, name.as_ptr()) };
        (!symbol.is_null()).then_some(symbol)
    }

    /// 창 뒤 배경을 흐린다. 실패하면 유리만 없이 계속 간다 — 앱 기동을 막지 않는다.
    pub fn apply(ns_window: *mut c_void, radius: u32) {
        if ns_window.is_null() {
            return;
        }
        // AppKit은 메인 스레드 전용이다. 설정 화면이 IPC 커맨드(워커 스레드)에서 이 함수를 부르게
        // 되는 날, 이 가드가 UB 대신 로그를 남긴다.
        if MainThreadMarker::new().is_none() {
            log::error!("창 유리는 메인 스레드에서만 걸 수 있습니다");
            return;
        }

        let (Some(main_connection), Some(set_blur)) = (
            lookup(c"CGSMainConnectionID"),
            lookup(c"CGSSetWindowBackgroundBlurRadius"),
        ) else {
            log::warn!("창 뒤 흐림 심볼이 없습니다 — 유리 없이 계속합니다");
            return;
        };

        // SAFETY: Tauri가 넘겨준 유효한 NSWindow 포인터이고 메인 스레드다. 두 심볼은 위에서 이름으로
        // 찾았고, 시그니처는 윈도서버 API의 것과 같다. 호출은 창 번호로 흐림 반경만 전달하며
        // 소유권을 넘기지 않는다.
        unsafe {
            let main_connection =
                std::mem::transmute::<*mut c_void, MainConnectionId>(main_connection);
            let set_blur = std::mem::transmute::<*mut c_void, SetBlurRadius>(set_blur);

            let window: &AnyObject = &*ns_window.cast::<AnyObject>();
            let window_number: i64 = msg_send![window, windowNumber];
            let Ok(window_id) = u32::try_from(window_number) else {
                // 창에 아직 창 장치가 없으면 0 이하가 나온다(예: 숨긴 채 띄우는 경우).
                log::warn!("창 번호가 유효하지 않습니다({window_number}) — 유리 없이 계속합니다");
                return;
            };

            let error = set_blur(main_connection(), window_id, radius as i32);
            if error != 0 {
                // 유리가 걸렸는지는 화면으로만 확인 가능하다(→ window-chrome.md#검증).
                // 그래서 API가 주는 유일한 기계 판독 신호를 버리지 않는다.
                log::warn!("창 뒤 흐림 실패 (CGError {error}) — 유리 없이 계속합니다");
            }
        }
    }
}

/// 창에 유리(뒤 배경 흐림)를 건다. macOS 밖에서는 아무 일도 하지 않는다 —
/// 그 경우 웹 쪽 캔버스가 불투명으로 남아 인앱 글라스로 자연 후퇴한다
/// (→ .claude/docs/design/decisions/glass.md).
///
/// **메인 스레드에서만 부른다** — AppKit 제약이다.
pub fn apply_window_glass(window: &tauri::WebviewWindow, radius: u32) {
    #[cfg(target_os = "macos")]
    if let Ok(ns_window) = window.ns_window() {
        platform::apply(ns_window, radius);
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = (window, radius);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // 왜: 설정 슬라이더는 끄는 동안 값을 연달아 보낸다. 그때마다 윈도서버를 부르면 프레임마다
    //     창 밖 왕복이 생기고, 범위 밖 값은 그대로 비공개 API로 들어간다.
    // 보장: 커맨드가 OS를 부르는 경우가 "잘린 값이 지금 걸린 값과 다를 때"로 한정된다.
    // 경계: 흐림이 실제로 걸렸는지는 화면으로만 확인된다(→ window-chrome.md#검증).
    //     여기서는 호출 여부의 판정만 본다.

    #[test]
    fn 상한을_넘는_요청은_상한으로_잘린다() {
        let mut applied = DEFAULT_BLUR_RADIUS;
        assert_eq!(
            resolve_blur_change(&mut applied, MAX_BLUR_RADIUS + 1),
            Some(MAX_BLUR_RADIUS)
        );
        assert_eq!(applied, MAX_BLUR_RADIUS);
    }

    #[test]
    fn 같은_값이_다시_오면_os를_부르지_않는다() {
        let mut applied = DEFAULT_BLUR_RADIUS;
        assert_eq!(resolve_blur_change(&mut applied, DEFAULT_BLUR_RADIUS), None);
    }

    #[test]
    fn 자른_뒤_같아지는_요청도_부르지_않는다() {
        let mut applied = MAX_BLUR_RADIUS;
        assert_eq!(resolve_blur_change(&mut applied, u32::MAX), None);
        assert_eq!(applied, MAX_BLUR_RADIUS);
    }

    #[test]
    fn 값이_바뀌면_새_반경을_돌려주고_기억한다() {
        let mut applied = DEFAULT_BLUR_RADIUS;
        assert_eq!(resolve_blur_change(&mut applied, 0), Some(0));
        assert_eq!(applied, 0);
    }
}
