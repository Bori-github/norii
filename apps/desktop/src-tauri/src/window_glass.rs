//! 창 뒤 배경 흐림(유리) — macOS.
//!
//! macOS에는 **창 뒤를 흐리는 공개 API가 없다.** 선택지는 둘뿐이다:
//!   1. `NSVisualEffectView`(Tauri의 `windowEffects`) — 뒤를 비추는 게 아니라 **테마 색을 띤 서리 재질**을
//!      덧대는 것이다. 실측 결과 배경이 바뀌어도 색이 4~5밖에 변하지 않아 "유리"로 보이지 않았다.
//!   2. CGS(윈도서버) 비공개 API로 **창 뒤 실제 배경을 흐린다** — 바탕화면·다른 창이 그대로 비친다.
//!
//! norii는 2번을 쓴다. 웹뷰 투명 배경 때문에 이미 비공개 API 선을 넘었으므로(`macOSPrivateApi`)
//! 새로 잃는 것은 없다(→ .claude/docs/platform-strategy.md#배포-경로--app-store는-비목표).
//! 설정값·기본값의 단일 출처는 .claude/docs/design/window-chrome.md다.

/// 창 뒤 흐림 반경(px). 0이면 흐림 없음.
///
/// 값의 의미: 창이 투명한 만큼 뒤가 비치고, 그 비친 배경을 이 반경으로 흐린다.
/// 추후 설정 화면에서 사용자가 조절한다(→ window-chrome.md).
pub const DEFAULT_BLUR_RADIUS: u32 = 30;

#[cfg(target_os = "macos")]
mod platform {
    use objc2::msg_send;
    use objc2::runtime::AnyObject;

    // 윈도서버(CoreGraphics) 비공개 심볼 — 헤더가 없어 직접 선언한다.
    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" {
        fn CGSMainConnectionID() -> i32;
        fn CGSSetWindowBackgroundBlurRadius(connection: i32, window: i64, radius: i32) -> i32;
    }

    /// 창 뒤 배경을 흐린다. 실패해도 앱 동작을 막지 않는다 — 유리가 안 걸릴 뿐이다.
    pub fn apply(ns_window: *mut std::ffi::c_void, radius: u32) {
        if ns_window.is_null() {
            return;
        }
        // SAFETY: Tauri가 넘겨준 유효한 NSWindow 포인터다. windowNumber는 인자 없는 게터이며,
        // CGS 호출은 그 창 번호로 윈도서버에 흐림 반경만 전달한다(소유권을 넘기지 않는다).
        unsafe {
            let window: &AnyObject = &*ns_window.cast::<AnyObject>();
            let window_number: i64 = msg_send![window, windowNumber];
            let _ = CGSSetWindowBackgroundBlurRadius(
                CGSMainConnectionID(),
                window_number,
                radius as i32,
            );
        }
    }
}

/// 창에 유리(뒤 배경 흐림)를 건다. macOS 밖에서는 아무 일도 하지 않는다 —
/// 그 경우 웹 쪽 캔버스가 불투명으로 남아 인앱 글라스로 자연 후퇴한다
/// (→ .claude/docs/design/decisions/0003-opaque-fallback-outside-macos.md).
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
