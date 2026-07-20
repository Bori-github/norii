//! 열기 파이프라인의 디코드 단계 — 순서·규칙의 단일 출처:
//! .claude/docs/file-lifecycle.md#인코딩-정책.
//!
//! 메모리·저장은 항상 UTF-8이다. 비UTF-8(UTF-16·레거시)은 여기서 UTF-8로 변환해 열고,
//! 원본 인코딩 라벨을 보고한다 — 저장 재작성의 승인(배너)은 프론트 소관이다.

use crate::error::AppError;

/// 디코드 결과. 개행은 원본 그대로 두고(EOL 판정은 eol 모듈), BOM만 본문에서 제거한다.
pub struct DecodedText {
    /// BOM이 제거된 UTF-8 본문.
    pub text: String,
    /// 감지된 원본 인코딩(WHATWG 라벨 소문자, "utf-8"|"euc-kr"|"utf-16le"…).
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
/// (→ rust-commands.md). WHATWG 라벨(encoding_rs 표준)을 받고, 알 수 없는 라벨은
/// `AppError::Encoding`이다.
pub fn decode_document(
    bytes: &[u8],
    encoding_override: Option<&str>,
) -> Result<DecodedText, AppError> {
    if let Some(label) = encoding_override {
        return decode_with_override(bytes, label);
    }

    // 1단계: BOM 스니핑 — 있으면 그 인코딩으로 확정한다.
    if bytes.starts_with(UTF8_BOM) {
        // BOM이 인코딩을 확정했으므로 검증 실패는 "미지원 인코딩"이 아니라 손상이다.
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
    if bytes.starts_with(UTF16_LE_BOM) {
        // BOM이 인코딩을 확정했다 — 디코드 실패(대체 문자)는 감지 대상이 아니라 손상이다
        // (UTF-8 BOM의 손상 판정과 같은 원칙).
        return decode_utf16(&bytes[UTF16_LE_BOM.len()..], encoding_rs::UTF_16LE, true)
            .ok_or_else(utf16_corrupt_error);
    }
    if bytes.starts_with(UTF16_BE_BOM) {
        return decode_utf16(&bytes[UTF16_BE_BOM.len()..], encoding_rs::UTF_16BE, true)
            .ok_or_else(utf16_corrupt_error);
    }

    // 2단계: 널 바이트 검사(바이너리 판정) — BOM 없는 UTF-16도 여기서 판정한다.
    match sniff_null_bytes(bytes)? {
        Some(encoding) => {
            // 디코드 검증 — 홀짝 일관성만의 판정은 관대해 바이너리를 깨진 텍스트로
            // 열 수 있다. 판정된 UTF-16으로 디코드해 깨지면 바이너리로 거부한다.
            decode_utf16(bytes, encoding, false)
                .ok_or_else(|| AppError::Encoding("바이너리 파일은 열 수 없습니다".into()))
        }
        None => {
            // 3단계: UTF-8 엄격 검증 — 대다수 파일이 여기서 끝난다.
            if let Ok(text) = std::str::from_utf8(bytes) {
                return Ok(DecodedText {
                    text: text.to_owned(),
                    encoding: "utf-8".into(),
                    has_bom: false,
                });
            }
            // 4단계: chardetng 감지 → encoding_rs 변환. 감지는 항상 추측을 반환하므로
            // 이 단계는 실패하지 않는다 — 오판은 배너·재해석·원본 불변 안전망이 다룬다.
            Ok(detect_and_convert(bytes))
        }
    }
}

fn utf16_corrupt_error() -> AppError {
    AppError::Encoding(
        "UTF-16 BOM이 있지만 본문이 UTF-16이 아닙니다 — 파일이 손상된 것으로 보입니다".into(),
    )
}

/// UTF-16 바이트를 UTF-8로 변환한다. 디코드가 대체 문자를 만들면(짝 없는 서로게이트·홀수
/// 길이) None — 호출부가 손상/바이너리로 판정한다.
fn decode_utf16(
    bytes: &[u8],
    encoding: &'static encoding_rs::Encoding,
    has_bom: bool,
) -> Option<DecodedText> {
    let (text, had_errors) = encoding.decode_without_bom_handling(bytes);
    if had_errors {
        return None;
    }
    Some(DecodedText {
        text: text.into_owned(),
        encoding: encoding.name().to_ascii_lowercase(),
        has_bom,
    })
}

/// 4단계 — chardetng로 감지하고 encoding_rs로 변환한다. UTF-8은 3단계에서 확정됐으므로
/// 감지 후보에서 제외한다(allow_utf8=false). 디코드는 손실 허용(대체 문자) — 오판이어도
/// 저장 전까지 원본이 불변이고 배너가 감지 결과를 보여 준다.
fn detect_and_convert(bytes: &[u8]) -> DecodedText {
    // ISO-2022-JP 감지 허용 — 크레이트가 경고하는 위험은 "스크립트가 도는 웹 페이지" 디코드
    // 상황이고, norii는 로컬 문서를 열 뿐이며 프리뷰는 sanitize를 거친다(→ security.md).
    let mut detector = chardetng::EncodingDetector::new(chardetng::Iso2022JpDetection::Allow);
    detector.feed(bytes, true);
    // UTF-8은 3단계 엄격 검증에서 이미 확정됐다 — 여기 온 바이트는 UTF-8이 아니므로 제외.
    let encoding = detector.guess(None, chardetng::Utf8Detection::Deny);
    let (text, _encoding_used, _had_errors) = encoding.decode(bytes);
    DecodedText {
        text: text.into_owned(),
        encoding: encoding.name().to_ascii_lowercase(),
        has_bom: false,
    }
}

fn decode_with_override(bytes: &[u8], label: &str) -> Result<DecodedText, AppError> {
    let Some(encoding) = encoding_rs::Encoding::for_label(label.as_bytes()) else {
        return Err(AppError::Encoding(format!(
            "알 수 없는 인코딩 라벨입니다: {label} (WHATWG 라벨을 사용하세요)"
        )));
    };
    // 재해석은 전 단계(BOM 스니핑 포함)를 건너뛰고 전체 바이트를 그대로 디코드한다 —
    // BOM도 내용으로 노출되고, 깨진 결과도 있는 그대로 보여 준다(사용자 명시 선택,
    // → file-lifecycle.md#인코딩-정책 수동 재해석).
    let (text, _had_errors) = encoding.decode_without_bom_handling(bytes);
    Ok(DecodedText {
        text: text.into_owned(),
        encoding: encoding.name().to_ascii_lowercase(),
        has_bom: false,
    })
}

/// 앞 512바이트의 널 바이트를 검사한다. 홀수 인덱스에만 일관되게 있으면 UTF-16 LE,
/// 짝수 인덱스에만 일관되게 있으면 UTF-16 BE 후보(호출부가 디코드 검증), 불규칙하면
/// 바이너리 거부, 없으면 None(다음 단계로).
fn sniff_null_bytes(bytes: &[u8]) -> Result<Option<&'static encoding_rs::Encoding>, AppError> {
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
        (false, false) => Ok(None),
        // 상위 바이트(홀수 인덱스) 쪽이 0 = LE, 하위 바이트(짝수 인덱스) 쪽이 0 = BE.
        (false, true) => Ok(Some(encoding_rs::UTF_16LE)),
        (true, false) => Ok(Some(encoding_rs::UTF_16BE)),
        (true, true) => Err(AppError::Encoding("바이너리 파일은 열 수 없습니다".into())),
    }
}

/// 테스트 공용 표본 — 감지(chardetng)는 통계적이라 몇 바이트짜리 표본은 오판하므로,
/// 현실적인 문장 길이의 EUC-KR 바이트를 여러 테스트가 공유한다.
#[cfg(test)]
pub(crate) mod test_support {
    /// "노리는 가볍고 빠른 마크다운 에디터다.\n한글 문서를 안전하게 연다.\n"의 EUC-KR.
    pub(crate) const EUC_KR_SAMPLE: &[u8] = &[
        0xB3, 0xEB, 0xB8, 0xAE, 0xB4, 0xC2, 0x20, 0xB0, 0xA1, 0xBA, 0xB1, 0xB0, 0xED, 0x20, 0xBA,
        0xFC, 0xB8, 0xA5, 0x20, 0xB8, 0xB6, 0xC5, 0xA9, 0xB4, 0xD9, 0xBF, 0xEE, 0x20, 0xBF, 0xA1,
        0xB5, 0xF0, 0xC5, 0xCD, 0xB4, 0xD9, 0x2E, 0x0A, 0xC7, 0xD1, 0xB1, 0xDB, 0x20, 0xB9, 0xAE,
        0xBC, 0xAD, 0xB8, 0xA6, 0x20, 0xBE, 0xC8, 0xC0, 0xFC, 0xC7, 0xCF, 0xB0, 0xD4, 0x20, 0xBF,
        0xAC, 0xB4, 0xD9, 0x2E, 0x0A,
    ];

    pub(crate) const EUC_KR_SAMPLE_TEXT: &str =
        "노리는 가볍고 빠른 마크다운 에디터다.\n한글 문서를 안전하게 연다.\n";
}

#[cfg(test)]
mod tests {
    use super::test_support::{EUC_KR_SAMPLE, EUC_KR_SAMPLE_TEXT};
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

    // 집행: file-lifecycle.md#인코딩-정책 — 파이프라인 1단계 "UTF-16도 UTF-8로 변환해 연다".
    // 왜: BOM 있는 UTF-16은 확정 판별이 가능한데도 못 열면 파일 강건성이 무의미하다.
    // 보장: UTF-16 LE/BE BOM 파일이 UTF-8 본문으로 변환되고, 원본 인코딩 라벨과
    //       has_bom=true(저장 시 BOM 유지)가 보고된다.
    // 경계: 저장이 실제로 UTF-8로 나가는 것은 fs_commands 왕복 테스트가 검증한다.
    #[test]
    fn utf16_bom_파일은_utf8로_변환해_열린다() {
        let le = decode_document(&[0xFF, 0xFE, 0x6E, 0x00], None).unwrap();
        assert_eq!(le.text, "n");
        assert_eq!(le.encoding, "utf-16le");
        assert!(le.has_bom);

        let be = decode_document(&[0xFE, 0xFF, 0x00, 0x6E], None).unwrap();
        assert_eq!(be.text, "n");
        assert_eq!(be.encoding, "utf-16be");
        assert!(be.has_bom);
    }

    // 집행: file-lifecycle.md#인코딩-정책 — 파이프라인 2단계(널 바이트 규칙, VS Code와 동일).
    // 왜: 바이너리를 텍스트로 열면 화면이 깨지고, 저장하면 파일이 파괴된다.
    // 보장: 불규칙한 널 바이트는 바이너리로 거부하고, 홀수/짝수 일관 널은 BOM 없는
    //       UTF-16으로 판정해 변환한다.
    // 경계: 512바이트 이후에만 널이 있는 파일은 통과한다 — 스캔 범위는 앞 512바이트다.
    #[test]
    fn 널_바이트_규칙_바이너리는_거부하고_bom_없는_utf16은_변환한다() {
        // 불규칙 널 = 바이너리.
        let binary = decode_document(&[0x89, 0x50, 0x00, 0x00, 0x0D, 0x0A], None);
        assert!(matches!(binary, Err(AppError::Encoding(_))));
        // "no"의 UTF-16 LE (널이 홀수 인덱스에만).
        let le = decode_document(&[0x6E, 0x00, 0x6F, 0x00], None).unwrap();
        assert_eq!(le.text, "no");
        assert_eq!(le.encoding, "utf-16le");
        assert!(!le.has_bom);
        // "no"의 UTF-16 BE (널이 짝수 인덱스에만).
        let be = decode_document(&[0x00, 0x6E, 0x00, 0x6F], None).unwrap();
        assert_eq!(be.text, "no");
        assert_eq!(be.encoding, "utf-16be");
        assert!(!be.has_bom);
    }

    // 집행: file-lifecycle.md#인코딩-정책 — 2단계 디코드 검증.
    // 왜: 홀짝 일관성만의 판정은 관대해(널 1개도 UTF-16 분류) 바이너리를 깨진 텍스트로
    //     열 수 있다 — 판정된 UTF-16으로 실제 디코드해 깨지면 텍스트가 아니다.
    // 보장: 널 패턴은 UTF-16 LE로 일관되지만 디코드가 대체 문자를 만드는 바이트
    //       (짝 없는 서로게이트·홀수 길이)는 바이너리로 거부된다.
    // 경계: 모든 바이트 쌍이 유효 코드 유닛인 바이너리는 통과한다 — 그 오판은
    //       배너 + 저장 전 원본 불변 안전망이 다룬다(문서화된 잔여 위험).
    #[test]
    fn 널_패턴이_utf16이어도_디코드가_깨지면_바이너리로_거부한다() {
        // [0x41,0x00]='A', [0x34,0xD8]=짝 없는 상위 서로게이트(U+D834) — 널은 홀수 인덱스에만.
        let lone_surrogate = decode_document(&[0x41, 0x00, 0x34, 0xD8], None);
        assert!(matches!(lone_surrogate, Err(AppError::Encoding(_))));
        // 홀수 길이 — 마지막 코드 유닛이 불완전하다. 널은 홀수 인덱스에만.
        let odd_length = decode_document(&[0x41, 0x00, 0x42], None);
        assert!(matches!(odd_length, Err(AppError::Encoding(_))));
    }

    // 집행: file-lifecycle.md#인코딩-정책 — 파이프라인 4단계(chardetng 감지 → encoding_rs 변환).
    // 왜: EUC-KR 레거시 한글 문서를 여는 것이 파일 강건성의 대표 시나리오다.
    // 보장: UTF-8 검증에 실패한 바이트가 감지·변환되어 열리고, 감지된 인코딩 라벨이
    //       보고된다(배너 안내의 근거). 이 단계는 실패하지 않는다 — 거부는 2단계뿐이다.
    // 경계: 감지는 통계적이라 표본이 몇 글자면 오판할 수 있다 — 그 구제는
    //       encoding_override(재해석)와 원본 불변 안전망 소관이다.
    #[test]
    fn 비utf8_바이트는_감지해_utf8로_변환한다() {
        let decoded = decode_document(EUC_KR_SAMPLE, None).unwrap();
        assert_eq!(decoded.text, EUC_KR_SAMPLE_TEXT);
        assert_eq!(decoded.encoding, "euc-kr");
        assert!(!decoded.has_bom);
    }

    // 집행: file-lifecycle.md#인코딩-정책 — BOM은 인코딩을 "확정"한다. 확정 후 검증 실패는
    //       감지 대상이 아니라 손상이다.
    // 왜: 손상 파일에 "미지원 인코딩" 공용 메시지를 쓰면 사용자가 지원을 헛되이 기다린다
    //     — 에러 메시지는 사용자 행동을 안내하는 UI다.
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
    //       라벨은 WHATWG(encoding_rs 표준), 알 수 없는 라벨은 AppError::Encoding.
    // 왜: 수동 재해석("Reopen with Encoding")은 감지 오판의 유일한 구제 수단이다.
    // 보장: override="utf-8"은 BOM 스니핑 없이 전체 바이트를 디코드하고(BOM이 내용으로 노출),
    //       "euc-kr" 같은 유효 라벨은 그 인코딩으로 디코드되며, 미지 라벨은 거부된다.
    // 경계: 재해석은 검증하지 않는다 — 깨진 결과도 있는 그대로 보여준다(사용자 명시 선택).
    #[test]
    fn encoding_override_는_bom_스니핑을_건너뛰고_라벨로_디코드한다() {
        let mut bytes = vec![0xEF, 0xBB, 0xBF];
        bytes.extend_from_slice("x".as_bytes());
        let decoded = decode_document(&bytes, Some("utf-8")).unwrap();
        assert_eq!(decoded.text, "\u{FEFF}x");
        assert!(!decoded.has_bom);

        // "한글" EUC-KR 바이트를 명시 라벨로 재해석한다.
        let euc_kr = decode_document(&[0xC7, 0xD1, 0xB1, 0xDB], Some("euc-kr")).unwrap();
        assert_eq!(euc_kr.text, "한글");
        assert_eq!(euc_kr.encoding, "euc-kr");

        let unknown = decode_document(b"x", Some("no-such-encoding"));
        assert!(matches!(unknown, Err(AppError::Encoding(_))));
    }
}
