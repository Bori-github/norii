//! 상단 드래그 띠 — macOS.
//!
//! 타이틀바를 오버레이로 두면 웹뷰가 창 맨 위까지 올라와 **상단 전체가 한 장의 유리**가 된다.
//! 그 대가로 창을 끌 수 없게 된다: 웹뷰가 마우스 다운을 가로채고, 웹 쪽에서 IPC로 드래그를
//! 요청해도 native `performWindowDragWithEvent:`에 넘길 **살아 있는 NSEvent가 이미 사라진 뒤**다(tauri#9503).
//!
//! 그래서 웹뷰 **위에** 투명한 네이티브 뷰를 한 장 얹는다. 그 띠에서 눌린 마우스는 웹뷰를 거치지
//! 않고 AppKit이 직접 처리하므로, IPC를 타지 않고 창이 끌린다 — 네이티브 앱과 같은 경로다.
//!
//! 값의 단일 출처는 .claude/docs/design/window-chrome.md다.

/// 드래그 띠 높이(px). 웹 쪽 탭바는 이만큼 위를 비워 띠 아래에서 시작하고,
/// 표준 창 버튼은 이 높이의 세로 중앙에 놓인다(→ window-chrome.md).
pub const TITLEBAR_STRIP_HEIGHT: f64 = 36.0;

/// 띠에서 클릭이 웹뷰로 통과하는 영역(→ window-chrome.md#계약--드래그-띠).
/// 표준 창 버튼 오른쪽에 둔다 — 겹치면 토글이 그 버튼 아래로 들어간다.
pub const TITLEBAR_CUTOUT_X: f64 = 70.0;
pub const TITLEBAR_CUTOUT_WIDTH: f64 = 32.0;

#[cfg(target_os = "macos")]
mod platform {
    use std::sync::OnceLock;

    use objc2::rc::Retained;
    use objc2::runtime::{AnyClass, AnyObject, ClassBuilder, NSObject, Sel};
    use objc2::{class, msg_send, sel, MainThreadMarker};

    use crate::mac_geometry::{CGPoint, CGRect, CGSize};

    // 창이 리사이즈돼도 띠가 상단에 붙어 폭을 따라가게 한다.
    const NS_VIEW_WIDTH_SIZABLE: usize = 2;
    const NS_VIEW_MIN_Y_MARGIN: usize = 8;
    // addSubview:positioned:relativeTo: 의 NSWindowAbove — 웹뷰 위에 얹는다.
    const NS_WINDOW_ABOVE: isize = 1;

    /// 띠에서 마우스가 눌리면 그 **살아 있는 이벤트**를 창에 넘겨 네이티브 드래그를 시작한다.
    ///
    /// 이것이 웹뷰가 할 수 없는 일이다 — JS에서 IPC로 넘어오는 사이 NSEvent가 사라진다(tauri#9503).
    unsafe extern "C" fn mouse_down(this: &AnyObject, _cmd: Sel, event: *mut AnyObject) {
        if event.is_null() {
            return;
        }
        // SAFETY: AppKit이 이 뷰의 mouseDown:으로 부른 것이므로 메인 스레드이고, event는 유효하다.
        // performWindowDragWithEvent:는 이벤트를 빌려 쓸 뿐 소유권을 가져가지 않는다.
        unsafe {
            let window: *mut AnyObject = msg_send![this, window];
            if window.is_null() {
                return;
            }
            let _: () = msg_send![window, performWindowDragWithEvent: event];
        }
    }

    /// 이 영역 안에서는 `nil`을 돌려 클릭이 아래 웹뷰로 내려가게 한다.
    ///
    /// `hitTest:`가 받는 점은 **superview 좌표**다. 띠는 x=0에서 시작하지만 프레임을 읽어
    /// 빼 준다 — 시작점이 바뀌어도 영역이 따라 움직인다.
    unsafe extern "C" fn hit_test(this: &AnyObject, _cmd: Sel, point: CGPoint) -> *mut AnyObject {
        // SAFETY: AppKit이 이 뷰의 hitTest:로 부른 것이므로 메인 스레드이고 this는 유효하다.
        unsafe {
            let frame: CGRect = msg_send![this, frame];
            let local_x = point.x - frame.origin.x;
            let cutout =
                super::TITLEBAR_CUTOUT_X..super::TITLEBAR_CUTOUT_X + super::TITLEBAR_CUTOUT_WIDTH;
            if cutout.contains(&local_x) {
                return std::ptr::null_mut();
            }
            msg_send![super(this, class!(NSView)), hitTest: point]
        }
    }

    /// 드래그 띠 전용 NSView 서브클래스를 **런타임에 한 번** 등록한다.
    ///
    /// # `setMovableByWindowBackground`를 쓰지 않는 이유 (한 번 밟은 지뢰)
    ///
    /// 드래그를 되찾는 가장 쉬운 길처럼 보이는 게 창에 `isMovableByWindowBackground = true`를
    /// 켜는 것이다. 실제로 한 번 그렇게 했고, 두 가지가 깨졌다.
    ///
    /// 이 플래그의 의미는 "창 배경을 잡으면 창이 움직인다"인데, AppKit이 말하는 **배경**은
    /// "`mouseDownCanMoveWindow`가 참인 뷰"이고 그 값은 **불투명하지 않은 뷰에서 기본이 참**이다.
    /// 투명 창에서는 웹뷰가 배경을 그리지 않으므로 **웹뷰 전체가 배경**으로 판정된다.
    ///
    /// ```text
    /// 의도    상단 28px 띠만 손잡이
    /// 실제    띠 + 웹뷰 전체가 손잡이
    ///   → 에디터에서 마우스를 누르면 AppKit이 드래그로 가로채 **글자를 선택할 수 없다**
    ///   → 본문 아무 데나 잡아도 창이 끌린다
    /// ```
    ///
    /// 더 나쁜 것은 **증상이 원인을 가린다**는 점이다. 창이 잘 끌리니 "드래그 성공"으로 보이지만,
    /// 실은 띠가 동작한 게 아니라 창 전체가 손잡이였을 뿐이다 — 그 착각 때문에 에디터가 망가진 것을
    /// 한참 뒤에야 알았다. 증상(글자 선택 불가)이 원인(창 설정 한 줄)에서 멀어 추적도 어렵다.
    ///
    /// 그래서 창 전체를 손잡이로 만들지 않고, **이 뷰만** 마우스를 받아 드래그를 시작한다.
    fn drag_strip_class() -> Option<&'static AnyClass> {
        static CLASS: OnceLock<Option<&'static AnyClass>> = OnceLock::new();
        *CLASS.get_or_init(|| {
            let mut builder = ClassBuilder::new(c"NoriiTitlebarDragStrip", class!(NSView))?;
            // SAFETY: 시그니처가 mouseDown:의 것(id, SEL, NSEvent*)과 일치한다.
            unsafe {
                builder.add_method(
                    sel!(mouseDown:),
                    mouse_down as unsafe extern "C" fn(_, _, _),
                );
                // SAFETY: 시그니처가 hitTest:의 것(id, SEL, NSPoint → NSView*)과 일치한다.
                builder.add_method(
                    sel!(hitTest:),
                    hit_test as unsafe extern "C" fn(_, _, _) -> _,
                );
            }
            Some(builder.register())
        })
    }

    pub fn attach(ns_window: *mut std::ffi::c_void, height: f64) {
        if ns_window.is_null() {
            return;
        }
        // AppKit은 메인 스레드 전용이다 — 뷰를 만들고 계층에 꽂는 일은 특히 그렇다.
        if MainThreadMarker::new().is_none() {
            log::error!("드래그 띠는 메인 스레드에서만 얹을 수 있습니다");
            return;
        }

        let Some(strip_class) = drag_strip_class() else {
            log::error!("드래그 띠 클래스를 등록하지 못했습니다");
            return;
        };

        // SAFETY: Tauri가 넘겨준 유효한 NSWindow 포인터이고 메인 스레드다. 아래 호출은 모두 AppKit의
        // 공개 API다. alloc/init이 돌려주는 +1 소유권은 Retained가 받아 두었다가, addSubview:가 자기
        // 몫으로 retain한 뒤 이 함수를 벗어나며 놓는다 — 뷰는 계층이 유지하고 누수는 없다.
        unsafe {
            let window: &AnyObject = &*ns_window.cast::<AnyObject>();

            let content_view: *mut AnyObject = msg_send![window, contentView];
            if content_view.is_null() {
                return;
            }
            let content: &AnyObject = &*content_view;
            let bounds: CGRect = msg_send![content, bounds];

            let strip: *mut AnyObject = msg_send![strip_class, alloc];
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
            let Some(strip) = Retained::from_raw(strip.cast::<NSObject>()) else {
                return;
            };
            let _: () = msg_send![
                &*strip,
                setAutoresizingMask: NS_VIEW_WIDTH_SIZABLE | NS_VIEW_MIN_Y_MARGIN
            ];
            let _: () = msg_send![
                content,
                addSubview: &*strip,
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
