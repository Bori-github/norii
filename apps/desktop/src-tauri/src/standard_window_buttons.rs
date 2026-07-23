//! 표준 창 버튼 세로 정렬 — 세 버튼(닫기·최소화·확대)을 띠 세로 중앙으로 옮기고,
//! 창 변화마다 다시 적용한다. 왜 네이티브인지·전체화면 예외는 window-chrome.md가 소유한다.

use crate::titlebar_drag::TITLEBAR_STRIP_HEIGHT;

#[cfg(target_os = "macos")]
mod platform {
    use std::sync::OnceLock;

    use objc2::runtime::{AnyClass, AnyObject, ClassBuilder, Sel};
    use objc2::{class, msg_send, sel, MainThreadMarker};

    use crate::mac_geometry::{CGPoint, CGRect};

    // NSWindowButton: close=0 · miniaturize=1 · zoom=2.
    const STANDARD_BUTTONS: [isize; 3] = [0, 1, 2];
    // NSWindowStyleMaskFullScreen = 1 << 14.
    const NS_WINDOW_STYLE_MASK_FULLSCREEN: usize = 1 << 14;

    /// 세 버튼을 띠 세로 중앙에 놓는다. 절대 위치라 여러 번 불러도 결과가 같다(멱등).
    ///
    /// theme frame은 뒤집히지 않은 좌표(원점 좌하단)라, 위에서 `d`만큼 내려온 지점의 y는
    /// `superH - d`다. 버튼 중심을 위에서 `strip/2`에 두려면 하단 원점 y = `superH - strip/2 - bh/2`.
    unsafe fn reposition(window: &AnyObject, strip_height: f64) {
        // SAFETY: window는 유효한 NSWindow, 메인 스레드. null 버튼/슈퍼뷰는 거른다.
        unsafe {
            // 전체화면은 OS가 표준 창 버튼을 직접 관리한다 — 손대면 버튼이 사라진다(→ window-chrome.md).
            let style_mask: usize = msg_send![window, styleMask];
            if style_mask & NS_WINDOW_STYLE_MASK_FULLSCREEN != 0 {
                return;
            }
            for kind in STANDARD_BUTTONS {
                let button: *mut AnyObject = msg_send![window, standardWindowButton: kind];
                if button.is_null() {
                    continue;
                }
                let button: &AnyObject = &*button;
                let superview: *mut AnyObject = msg_send![button, superview];
                if superview.is_null() {
                    continue;
                }
                let super_bounds: CGRect = msg_send![&*superview, bounds];
                let button_frame: CGRect = msg_send![button, frame];
                let origin = CGPoint {
                    x: button_frame.origin.x,
                    y: super_bounds.size.height
                        - strip_height / 2.0
                        - button_frame.size.height / 2.0,
                };
                let _: () = msg_send![button, setFrameOrigin: origin];
            }
        }
    }

    unsafe extern "C" fn on_window_change(
        _this: &AnyObject,
        _cmd: Sel,
        notification: *mut AnyObject,
    ) {
        if notification.is_null() {
            return;
        }
        // SAFETY: NSNotificationCenter가 부른 것이므로 메인 스레드이고 notification은 유효하다.
        unsafe {
            let window: *mut AnyObject = msg_send![&*notification, object];
            if window.is_null() {
                return;
            }
            reposition(&*window, super::TITLEBAR_STRIP_HEIGHT);
        }
    }

    fn observer_class() -> Option<&'static AnyClass> {
        static CLASS: OnceLock<Option<&'static AnyClass>> = OnceLock::new();
        *CLASS.get_or_init(|| {
            let mut builder =
                ClassBuilder::new(c"NoriiStandardWindowButtonCentering", class!(NSObject))?;
            // SAFETY: 시그니처가 알림 셀렉터(id, SEL, NSNotification*)와 일치한다.
            unsafe {
                builder.add_method(
                    sel!(onWindowChange:),
                    on_window_change as unsafe extern "C" fn(_, _, _),
                );
            }
            Some(builder.register())
        })
    }

    pub fn attach(ns_window: *mut std::ffi::c_void) {
        if ns_window.is_null() {
            return;
        }
        if MainThreadMarker::new().is_none() {
            log::error!("표준 창 버튼 정렬은 메인 스레드에서만 걸 수 있습니다");
            return;
        }

        let Some(observer_class) = observer_class() else {
            log::error!("표준 창 버튼 정렬 옵저버 클래스를 등록하지 못했습니다");
            return;
        };

        // SAFETY: Tauri가 넘긴 유효한 NSWindow, 메인 스레드. 아래는 모두 AppKit 공개 API다.
        unsafe {
            let window: &AnyObject = &*ns_window.cast::<AnyObject>();

            // 옵저버는 앱 수명 내내 살아야 한다 — NSNotificationCenter는 옵저버를 retain하지 않는다.
            // +1로 만들어 놓고 놓지 않아, 하나가 의도적으로 남는다(창 하나 = 옵저버 하나).
            let observer: *mut AnyObject = msg_send![observer_class, new];

            let center: *mut AnyObject = msg_send![class!(NSNotificationCenter), defaultCenter];
            // 리사이즈·전체화면 전환마다 AppKit이 버튼을 되돌리므로 그 세 알림을 듣는다.
            for name in [
                c"NSWindowDidResizeNotification".as_ptr(),
                c"NSWindowDidEnterFullScreenNotification".as_ptr(),
                c"NSWindowDidExitFullScreenNotification".as_ptr(),
            ] {
                let ns_name: *mut AnyObject =
                    msg_send![class!(NSString), stringWithUTF8String: name];
                let _: () = msg_send![
                    center,
                    addObserver: observer,
                    selector: sel!(onWindowChange:),
                    name: ns_name,
                    object: window
                ];
            }

            // 첫 정렬 — 알림을 기다리지 않고 지금 한 번 맞춘다.
            reposition(window, super::TITLEBAR_STRIP_HEIGHT);
        }
    }
}

/// 표준 창 버튼을 띠 세로 중앙에 정렬하고, 이후 창 변화마다 다시 적용되게 건다.
/// macOS 밖에서는 아무 일도 하지 않는다.
pub fn center_standard_window_buttons(window: &tauri::WebviewWindow) {
    #[cfg(target_os = "macos")]
    if let Ok(ns_window) = window.ns_window() {
        platform::attach(ns_window);
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = window;
    }
}
