//! CoreGraphics 기하 타입 — AppKit 프레임을 `msg_send!`로 넘기려면 인코딩을 알려야 한다.
//! titlebar_drag·standard_window_buttons가 공유한다.

#![cfg(target_os = "macos")]

use objc2::encode::{Encode, Encoding};

#[repr(C)]
#[derive(Clone, Copy)]
pub struct CGPoint {
    pub x: f64,
    pub y: f64,
}
#[repr(C)]
#[derive(Clone, Copy)]
pub struct CGSize {
    pub width: f64,
    pub height: f64,
}
#[repr(C)]
#[derive(Clone, Copy)]
pub struct CGRect {
    pub origin: CGPoint,
    pub size: CGSize,
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
