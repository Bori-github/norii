//! 열기 파이프라인의 디코드 단계 — M1 범위(UTF-8만).
//! 파이프라인 순서의 단일 출처: .claude/docs/file-lifecycle.md#인코딩-정책.
//!
//! M1은 저장이 원본 바이트를 재작성하게 되는 파일(비UTF-8)을 거부한다
//! (→ .claude/docs/implementation-plan.md M1). UTF-16 변환·chardetng 감지는 M2에서
//! 이 모듈의 거부 지점을 변환으로 바꿔 구현한다.

use crate::error::AppError;

/// 디코드 결과. 개행은 원본 그대로 두고(EOL 판정은 eol 모듈), BOM만 본문에서 제거한다.
pub struct DecodedText {
    /// BOM이 제거된 UTF-8 본문.
    pub text: String,
    /// 감지된 원본 인코딩(WHATWG 라벨). M1은 항상 "utf-8".
    pub encoding: String,
    /// 원본 BOM 유무 — 저장 시 그대로 유지한다(→ file-lifecycle.md#인코딩-정책).
    pub has_bom: bool,
}

/// UTF-8 BOM의 단일 출처 — 열기(제거)와 저장(복원)이 같은 정의를 본다(→ file-lifecycle.md).
pub(crate) const UTF8_BOM: &[u8] = &[0xEF, 0xBB, 0xBF];
const UTF16_LE_BOM: &[u8] = &[0xFF, 0xFE];
const UTF16_BE_BOM: &[u8] = &[0xFE, 0xFF];

/// 널 바이트 검사 범위(앞 512바이트) — VS Code와 동일 규칙(→ file-lifecycle.md 파이프라인 2단계).
const NULL_SCAN_LIMIT: usize = 512;

/// 파일 바이트를 UTF-8 본문으로 디코드한다.
///
/// `encoding_override`는 파이프라인 전 단계(BOM 스니핑 포함)를 건너뛰는 수동 재해석이다
/// (→ rust-commands.md). M1은 "utf-8" 라벨만 수용하고, 그 외 라벨은 비UTF-8 거부와 동일하게
/// `AppError::Encoding`을 반환한다(M2에서 encoding_rs 라벨 해석으로 확장).
pub fn decode_document(
    bytes: &[u8],
    encoding_override: Option<&str>,
) -> Result<DecodedText, AppError> {
    if let Some(label) = encoding_override {
        return decode_with_override(bytes, label);
    }

    // 1단계: BOM 스니핑 — 있으면 그 인코딩으로 확정한다.
    if bytes.starts_with(UTF8_BOM) {
        // BOM이 인코딩을 확정했으므로 검증 실패는 "미지원"(M2 감지 대상)이 아니라 손상이다.
        let Ok(text) = std::str::from_utf8(&bytes[UTF8_BOM.len()..]) else {
            return Err(AppError::Encoding(
                "UTF-8 BOM이 있지만 본문이 UTF-8이 아닙니다 — 파일이 손상된 것으로 보입니다".into(),
            ));
        };
        return Ok(DecodedText {
            text: text.to_owned(),
            encoding: "utf-8".into(),
            has_bom: true,
        });
    }
    if bytes.starts_with(UTF16_LE_BOM) || bytes.starts_with(UTF16_BE_BOM) {
        return Err(AppError::Encoding(
            "UTF-16 파일은 아직 지원되지 않습니다(M2에서 지원 예정)".into(),
        ));
    }

    // 2단계: 널 바이트 검사(바이너리 판정) — BOM 없는 UTF-16도 여기서 걸린다.
    check_null_bytes(bytes)?;

    // 3단계: UTF-8 엄격 검증 — M1은 여기서 끝난다(4단계 chardetng 감지는 M2).
    let text = validate_utf8(bytes)?;
    Ok(DecodedText {
        text,
        encoding: "utf-8".into(),
        has_bom: false,
    })
}

fn decode_with_override(bytes: &[u8], label: &str) -> Result<DecodedText, AppError> {
    // WHATWG 라벨은 대소문자 무시로 비교한다(encoding_rs 표준과 동일).
    if !label.eq_ignore_ascii_case("utf-8") && !label.eq_ignore_ascii_case("utf8") {
        return Err(AppError::Encoding(format!(
            "인코딩 재해석 '{label}'은 아직 지원되지 않습니다(M2에서 지원 예정)"
        )));
    }
    // 재해석은 전체 바이트를 그대로 디코드한다 — BOM도 내용으로 노출된다(→ file-lifecycle.md).
    let text = validate_utf8(bytes)?;
    Ok(DecodedText {
        text,
        encoding: "utf-8".into(),
        has_bom: false,
    })
}

fn validate_utf8(bytes: &[u8]) -> Result<String, AppError> {
    match std::str::from_utf8(bytes) {
        Ok(text) => Ok(text.to_owned()),
        Err(_) => Err(AppError::Encoding(
            "UTF-8이 아닌 파일은 아직 지원되지 않습니다(M2에서 지원 예정)".into(),
        )),
    }
}

/// 앞 512바이트의 널 바이트를 검사한다. 홀수/짝수 인덱스에만 일관되게 있으면 BOM 없는
/// UTF-16(LE/BE), 불규칙하면 바이너리다 — M1은 모두 거부한다(M2는 UTF-16을 변환으로 수용).
fn check_null_bytes(bytes: &[u8]) -> Result<(), AppError> {
    let scan = &bytes[..bytes.len().min(NULL_SCAN_LIMIT)];
    let mut null_at_odd = false;
    let mut null_at_even = false;
    for (index, byte) in scan.iter().enumerate() {
        if *byte == 0 {
            if index % 2 == 1 {
                null_at_odd = true;
            } else {
                null_at_even = true;
            }
        }
    }
    match (null_at_even, null_at_odd) {
        (false, false) => Ok(()),
        (false, true) | (true, false) => Err(AppError::Encoding(
            "BOM 없는 UTF-16으로 보이는 파일은 아직 지원되지 않습니다(M2에서 지원 예정)".into(),
        )),
        (true, true) => Err(AppError::Encoding("바이너리 파일은 열 수 없습니다".into())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // 집행: file-lifecycle.md#인코딩-정책 — 파이프라인 3단계(UTF-8 엄격 검증).
    // 왜: 대다수 파일이 이 경로로 열린다 — 평범한 UTF-8 문서가 열리지 않으면 앱이 무의미하다.
    // 보장: BOM 없는 UTF-8은 본문 그대로, encoding="utf-8"·has_bom=false로 디코드된다.
    // 경계: EOL 판정은 eol 모듈 소관 — 여기서는 개행을 건드리지 않는 것만 전제한다.
    #[test]
    fn 평범한_utf8_문서를_그대로_디코드한다() {
        let decoded = decode_document("# 노리\n한글 본문".as_bytes(), None).unwrap();
        assert_eq!(decoded.text, "# 노리\n한글 본문");
        assert_eq!(decoded.encoding, "utf-8");
        assert!(!decoded.has_bom);
    }

    // 집행: file-lifecycle.md#인코딩-정책 — 파이프라인 1단계(BOM 스니핑)와 BOM 정책.
    // 왜: BOM이 본문에 노출되면 에디터 첫 글자가 보이지 않는 문자로 오염되고,
    //     BOM 유무를 잃으면 저장이 원본 바이트를 바꾼다(라운드트립 파괴).
    // 보장: UTF-8 BOM은 본문에서 제거되고 has_bom=true로 보고된다.
    // 경계: 저장 시 BOM 복원은 save_file 테스트가 검증한다.
    #[test]
    fn utf8_bom_은_본문에서_제거하고_has_bom_으로_알린다() {
        let mut bytes = vec![0xEF, 0xBB, 0xBF];
        bytes.extend_from_slice("# norii".as_bytes());
        let decoded = decode_document(&bytes, None).unwrap();
        assert_eq!(decoded.text, "# norii");
        assert!(decoded.has_bom);
    }

    // 집행: implementation-plan.md M1 — 저장이 원본 바이트를 재작성하는 파일(비UTF-8)은 거부.
    // 왜: M1에서 UTF-16을 열어 저장하면 무단으로 UTF-8 재작성이 일어난다(정규화 승인은 M2).
    // 보장: UTF-16 BOM(LE/BE)은 AppError::Encoding으로 거부되고 파일은 건드리지 않는다.
    // 경계: M2에서 이 케이스는 "변환 후 배너·승인"으로 바뀐다 — 그때 이 테스트를 갱신한다.
    #[test]
    fn utf16_bom_파일은_m1에서_거부한다() {
        let le = decode_document(&[0xFF, 0xFE, 0x6E, 0x00], None);
        let be = decode_document(&[0xFE, 0xFF, 0x00, 0x6E], None);
        assert!(matches!(le, Err(AppError::Encoding(_))));
        assert!(matches!(be, Err(AppError::Encoding(_))));
    }

    // 집행: file-lifecycle.md#인코딩-정책 — 파이프라인 2단계(널 바이트 규칙, VS Code와 동일).
    // 왜: 바이너리를 텍스트로 열면 화면이 깨지고, 저장하면 파일이 파괴된다.
    // 보장: 불규칙한 널 바이트는 바이너리로 판정해 거부한다. 홀수/짝수 일관 널은
    //       BOM 없는 UTF-16으로 판정한다(M1은 거부, M2는 변환).
    // 경계: 512바이트 이후에만 널이 있는 파일은 통과한다 — 스캔 범위는 앞 512바이트다.
    #[test]
    fn 널_바이트_규칙_바이너리와_bom_없는_utf16을_거부한다() {
        // 불규칙 널 = 바이너리.
        let binary = decode_document(&[0x89, 0x50, 0x00, 0x00, 0x0D, 0x0A], None);
        assert!(matches!(binary, Err(AppError::Encoding(_))));
        // "no"의 UTF-16 LE (널이 홀수 인덱스에만).
        let utf16le = decode_document(&[0x6E, 0x00, 0x6F, 0x00], None);
        assert!(matches!(utf16le, Err(AppError::Encoding(_))));
        // "no"의 UTF-16 BE (널이 짝수 인덱스에만).
        let utf16be = decode_document(&[0x00, 0x6E, 0x00, 0x6F], None);
        assert!(matches!(utf16be, Err(AppError::Encoding(_))));
    }

    // 집행: implementation-plan.md M1 — 비UTF-8 파일 거부(chardetng 변환은 M2).
    // 왜: EUC-KR을 무단 UTF-8 재작성 없이 다루려면 M1은 열기 자체를 거부해야 한다.
    // 보장: UTF-8 엄격 검증에 실패하는 바이트(EUC-KR "한글" 등)는 Encoding 에러다.
    // 경계: M2에서 이 케이스는 chardetng 감지·변환으로 바뀐다.
    #[test]
    fn 비utf8_바이트는_m1에서_거부한다() {
        // "한글"의 EUC-KR 인코딩.
        let euc_kr = decode_document(&[0xC7, 0xD1, 0xB1, 0xDB], None);
        assert!(matches!(euc_kr, Err(AppError::Encoding(_))));
    }

    // 집행: file-lifecycle.md#인코딩-정책 — BOM은 인코딩을 "확정"한다. 확정 후 검증 실패는
    //       감지 대상(M2)이 아니라 손상이다.
    // 왜: "M2에서 지원 예정" 공용 메시지를 쓰면 사용자가 다음 버전을 헛되이 기다린다
    //     (적대적 리뷰 이슈 5 — 에러 메시지는 사용자 행동을 안내하는 UI다).
    // 보장: UTF-8 BOM 뒤 본문이 UTF-8이 아니면 "손상"을 안내하는 별도 메시지로 거부된다.
    // 경계: 손상 복구·재해석 시도는 하지 않는다 — 파일은 건드리지 않고 안내만 한다.
    #[test]
    fn bom_확정_후_본문이_utf8이_아니면_손상으로_안내한다() {
        let mut bytes = vec![0xEF, 0xBB, 0xBF];
        bytes.extend_from_slice(&[0xC7, 0xD1]); // EUC-KR "한" — UTF-8로는 불완전 시퀀스
        match decode_document(&bytes, None) {
            Err(AppError::Encoding(message)) => {
                assert!(message.contains("손상"), "손상 안내가 아니라: {message}");
            }
            Ok(_) => panic!("손상 파일이 열리면 안 된다"),
            Err(other) => panic!("Encoding이 아닌 에러: {other:?}"),
        }
    }

    // 집행: rust-commands.md open_file — encoding_override는 파이프라인 전 단계를 건너뛴다.
    // 왜: 수동 재해석("Reopen with Encoding")의 계약을 지금 고정한다(→ file-lifecycle.md).
    // 보장: override="utf-8"은 BOM 스니핑 없이 전체 바이트를 디코드한다(BOM이 내용으로 노출).
    //       M1이 지원하지 않는 라벨·알 수 없는 라벨은 AppError::Encoding이다.
    // 경계: 비UTF-8 라벨의 실제 디코드는 M2에서 encoding_rs로 구현·검증한다.
    #[test]
    fn encoding_override_는_bom_스니핑을_건너뛴다() {
        let mut bytes = vec![0xEF, 0xBB, 0xBF];
        bytes.extend_from_slice("x".as_bytes());
        let decoded = decode_document(&bytes, Some("utf-8")).unwrap();
        assert_eq!(decoded.text, "\u{FEFF}x");
        assert!(!decoded.has_bom);

        let unknown = decode_document(b"x", Some("euc-kr"));
        assert!(matches!(unknown, Err(AppError::Encoding(_))));
    }
}
