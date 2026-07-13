//! 상단 드래그 띠 — macOS.
//!
//! 타이틀바를 오버레이로 두면 웹뷰가 창 맨 위까지 올라와 **상단 전체가 한 장의 유리**가 된다.
//! 그 대가로 창을 끌 수 없게 된다: 웹뷰가 마우스 다운을 가로채고, 웹 쪽에서 IPC로 드래그를
//! 요청해도 native `performDrag(with:)`에 넘길 **살아 있는 NSEvent가 이미 사라진 뒤**다(tauri#9503).
//!
//! 그래서 웹뷰 **위에** 투명한 네이티브 뷰를 한 장 얹는다. 그 띠에서 눌린 마우스는 웹뷰를 거치지
//! 않고 AppKit이 직접 처리하므로, IPC를 타지 않고 창이 끌린다 — 네이티브 앱과 같은 경로다.
//!
//! 값의 단일 출처는 .claude/docs/design/window-chrome.md다.

/// 드래그 띠 높이(px). OS 타이틀바 높이와 같게 둔다 — 신호등이 이 띠 안에 놓이고,
/// 웹 쪽 탭바는 이만큼 위를 비워 띠 아래에서 시작한다(→ window-chrome.md).
pub const TITLEBAR_STRIP_HEIGHT: f64 = 28.0;

#[cfg(target_os = "macos")]
mod platform {
    use objc2::encode::{Encode, Encoding};
    use objc2::runtime::AnyObject;
    use objc2::{class, msg_send};

    // CoreGraphics 기하 타입 — 프레임을 넘기려면 인코딩을 알려야 한다.
    #[repr(C)]
    #[derive(Clone, Copy)]
    struct CGPoint {
        x: f64,
        y: f64,
    }
    #[repr(C)]
    #[derive(Clone, Copy)]
    struct CGSize {
        width: f64,
        height: f64,
    }
    #[repr(C)]
    #[derive(Clone, Copy)]
    struct CGRect {
        origin: CGPoint,
        size: CGSize,
    }

    // SAFETY: 세 타입 모두 CoreGraphics의 C 구조체와 필드 순서·표현이 같다(#[repr(C)] + f64).
    unsafe impl Encode for CGPoint {
        const ENCODING: Encoding = Encoding::Struct(
            "CGPoint",
            &[<f64 as Encode>::ENCODING, <f64 as Encode>::ENCODING],
        );
    }
    unsafe impl Encode for CGSize {
        const ENCODING: Encoding = Encoding::Struct(
            "CGSize",
            &[<f64 as Encode>::ENCODING, <f64 as Encode>::ENCODING],
        );
    }
    unsafe impl Encode for CGRect {
        const ENCODING: Encoding = Encoding::Struct(
            "CGRect",
            &[<CGPoint as Encode>::ENCODING, <CGSize as Encode>::ENCODING],
        );
    }

    // 창이 리사이즈돼도 띠가 상단에 붙어 폭을 따라가게 한다.
    const NS_VIEW_WIDTH_SIZABLE: usize = 2;
    const NS_VIEW_MIN_Y_MARGIN: usize = 8;
    // addSubview:positioned:relativeTo: 의 NSWindowAbove — 웹뷰 위에 얹는다.
    const NS_WINDOW_ABOVE: isize = 1;

    pub fn attach(ns_window: *mut std::ffi::c_void, height: f64) {
        if ns_window.is_null() {
            return;
        }

        // SAFETY: Tauri가 넘겨준 유효한 NSWindow 포인터다. 아래 호출은 모두 AppKit의 공개 API이며,
        // 새로 만든 NSView의 소유권은 addSubview:가 가져간다(뷰 계층이 유지한다).
        unsafe {
            let window: &AnyObject = &*ns_window.cast::<AnyObject>();

            // 창 배경(= 이 띠)을 잡으면 창이 움직인다. 웹뷰는 자기 마우스를 소비하므로 영향받지 않는다.
            let _: () = msg_send![window, setMovableByWindowBackground: true];

            let content_view: *mut AnyObject = msg_send![window, contentView];
            if content_view.is_null() {
                return;
            }
            let content: &AnyObject = &*content_view;
            let bounds: CGRect = msg_send![content, bounds];

            let strip: *mut AnyObject = msg_send![class!(NSView), alloc];
            let frame = CGRect {
                origin: CGPoint {
                    x: 0.0,
                    y: bounds.size.height - height,
                },
                size: CGSize {
                    width: bounds.size.width,
                    height,
                },
            };
            let strip: *mut AnyObject = msg_send![strip, initWithFrame: frame];
            if strip.is_null() {
                return;
            }
            let _: () = msg_send![
                strip,
                setAutoresizingMask: NS_VIEW_WIDTH_SIZABLE | NS_VIEW_MIN_Y_MARGIN
            ];
            let _: () = msg_send![
                content,
                addSubview: strip,
                positioned: NS_WINDOW_ABOVE,
                relativeTo: std::ptr::null::<AnyObject>()
            ];
        }
    }
}

/// 창 상단에 드래그 띠를 얹는다. macOS 밖에서는 아무 일도 하지 않는다 —
/// 그 경우 타이틀바를 OS가 그대로 소유하므로 띠가 필요 없다.
pub fn attach_titlebar_strip(window: &tauri::WebviewWindow, height: f64) {
    #[cfg(target_os = "macos")]
    if let Ok(ns_window) = window.ns_window() {
        platform::attach(ns_window, height);
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = (window, height);
    }
}
