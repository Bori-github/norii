//! EOL(개행) 판정·변환 — 정책의 단일 출처: .claude/docs/file-lifecycle.md#eol-정책.
//!
//! 판정 규칙: LF/CRLF 다수결(동률 LF), CR 단독은 집계에서 제외(CR-only 파일은 LF 판정).
//! 원본 개행이 판정 결과와 완전히 일치하지 않으면 mixed — 저장이 재작성하게 되므로
//! M1은 열기를 거부하고, M2부터 정규화 승인 대상이 된다.

use serde::{Deserialize, Serialize};

/// 판정된 EOL. IPC에서는 "lf"|"crlf" 문자열이다(→ rust-commands.md FileContent.eol).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "lowercase")]
pub enum Eol {
    Lf,
    Crlf,
}

impl Eol {
    fn as_str(self) -> &'static str {
        match self {
            Eol::Lf => "\n",
            Eol::Crlf => "\r\n",
        }
    }
}

/// EOL 판정 결과.
pub struct EolInfo {
    pub eol: Eol,
    /// 원본 개행이 판정 EOL과 완전히 일치하지 않음(혼합·CR-only) — 정규화 승인 대상.
    pub mixed: bool,
}

/// 본문의 개행을 집계해 EOL을 판정한다.
pub fn detect_eol(text: &str) -> EolInfo {
    let bytes = text.as_bytes();
    let mut crlf = 0usize;
    let mut lone_lf = 0usize;
    let mut lone_cr = 0usize;
    let mut index = 0usize;
    while index < bytes.len() {
        match bytes[index] {
            b'\r' => {
                if bytes.get(index + 1) == Some(&b'\n') {
                    crlf += 1;
                    index += 2;
                    continue;
                }
                lone_cr += 1;
            }
            b'\n' => {
                lone_lf += 1;
            }
            _ => {}
        }
        index += 1;
    }
    // 다수결 — 동률이면 LF. CR 단독은 집계 대상이 아니다(→ file-lifecycle.md#eol-정책).
    let eol = if crlf > lone_lf { Eol::Crlf } else { Eol::Lf };
    let mixed = lone_cr > 0 || (crlf > 0 && lone_lf > 0);
    EolInfo { eol, mixed }
}

/// 본문 개행을 LF로 정규화한다 — CM6 내부 문서는 LF다(→ file-lifecycle.md#eol-정책).
pub fn normalize_to_lf(text: &str) -> String {
    if !text.contains('\r') {
        return text.to_owned();
    }
    text.replace("\r\n", "\n").replace('\r', "\n")
}

/// LF 정규화된 본문에 판정 EOL을 적용한다 — 저장 직전 변환(→ file-lifecycle.md#eol-정책).
pub fn apply_eol(text_lf: &str, eol: Eol) -> String {
    match eol {
        Eol::Lf => text_lf.to_owned(),
        Eol::Crlf => text_lf.replace('\n', Eol::Crlf.as_str()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // 집행: file-lifecycle.md#eol-정책 — 단일 EOL 파일의 판정과 유지(M1 범위).
    // 왜: EOL이 오판되면 저장이 사용자가 입력하지 않은 바이트 재작성을 일으킨다.
    // 보장: 순수 LF → lf, 순수 CRLF → crlf, 둘 다 mixed=false. 개행 없는 파일은 lf.
    // 경계: 혼합 파일의 다수결 세부는 아래 테스트가 다룬다.
    #[test]
    fn 단일_eol_파일은_그_eol로_판정하고_mixed_가_아니다() {
        let lf = detect_eol("a\nb\nc");
        assert_eq!(lf.eol, Eol::Lf);
        assert!(!lf.mixed);

        let crlf = detect_eol("a\r\nb\r\nc");
        assert_eq!(crlf.eol, Eol::Crlf);
        assert!(!crlf.mixed);

        let none = detect_eol("한 줄");
        assert_eq!(none.eol, Eol::Lf);
        assert!(!none.mixed);
    }

    // 집행: file-lifecycle.md#eol-정책 — 다수결(동률 LF)·CR 단독 제외·mixed 판정.
    // 왜: M1은 mixed 파일을 거부하고 M2는 승인 후 이 판정 EOL로 통일한다 —
    //     판정이 흔들리면 두 마일스톤의 동작이 모두 흔들린다.
    // 보장: CRLF 다수면 crlf, 동률이면 lf. 혼합·CR-only는 mixed=true, CR-only는 lf 판정.
    // 경계: 거부/승인 흐름 자체는 open_file·프론트 테스트가 다룬다.
    #[test]
    fn 혼합_파일은_다수결로_판정하고_mixed_로_표시한다() {
        let crlf_major = detect_eol("a\r\nb\r\nc\nd");
        assert_eq!(crlf_major.eol, Eol::Crlf);
        assert!(crlf_major.mixed);

        let tie = detect_eol("a\r\nb\nc");
        assert_eq!(tie.eol, Eol::Lf);
        assert!(tie.mixed);

        let cr_only = detect_eol("a\rb\rc");
        assert_eq!(cr_only.eol, Eol::Lf);
        assert!(cr_only.mixed);
    }

    // 집행: file-lifecycle.md#eol-정책 — "CM6 내부 문서는 LF로 정규화하고, 저장 시 탭의 eol로 되돌린다".
    // 왜: 정규화·복원이 정확히 역연산이 아니면 편집하지 않은 문서의 저장이 바이트를 바꾼다.
    // 보장: CRLF 문서의 LF 정규화 → crlf 재적용이 원본과 동일하다(무손실 왕복).
    // 경계: mixed 문서의 왕복은 M1에서 열리지 않으므로 다루지 않는다(M2 정규화 승인).
    #[test]
    fn lf_정규화와_eol_재적용은_무손실_왕복이다() {
        let original = "# 제목\r\n\r\n본문\r\n";
        let normalized = normalize_to_lf(original);
        assert_eq!(normalized, "# 제목\n\n본문\n");
        assert_eq!(apply_eol(&normalized, Eol::Crlf), original);
        assert_eq!(apply_eol(&normalized, Eol::Lf), normalized);
    }
}
