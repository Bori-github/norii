//! 디스크 바이트의 내용 해시 — 저장 충돌 검사와 자기 저장 에코 억제의 기준값.
//! 정책의 단일 출처: .claude/docs/file-lifecycle.md#저장-원자성과-충돌-검사.

use sha2::{Digest, Sha256};

/// 바이트 내용의 SHA-256 소문자 hex. mtime은 세분성 문제로 기준으로 쓰지 않는다(→ file-lifecycle.md).
pub fn content_hash(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    let mut out = String::with_capacity(digest.len() * 2);
    for byte in digest {
        use std::fmt::Write;
        write!(&mut out, "{byte:02x}").expect("String 쓰기는 실패하지 않는다");
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    // 집행: file-lifecycle.md#저장-원자성과-충돌-검사 — 충돌 검사는 "디스크 내용 해시" 비교다.
    // 왜: 해시가 결정론적이지 않으면 모든 저장이 가짜 충돌이 되거나, 진짜 충돌을 놓친다.
    // 보장: 같은 바이트 → 같은 해시, 다른 바이트 → 다른 해시(SHA-256 고정).
    // 경계: 해시 알고리즘 자체의 암호학적 성질은 검증하지 않는다(sha2 크레이트 신뢰).
    #[test]
    fn 같은_바이트는_같은_해시_다른_바이트는_다른_해시() {
        let a = content_hash(b"# norii\n");
        let b = content_hash(b"# norii\n");
        let c = content_hash(b"# norii\r\n");
        assert_eq!(a, b);
        assert_ne!(a, c);
    }

    // 왜: 해시는 IPC로 오가는 문자열 키다 — 형식(64자 hex)이 흔들리면 프론트 비교가 무의미해진다.
    // 보장: SHA-256 표준 벡터와 일치하는 소문자 hex 64자.
    // 경계: 빈 입력 외 표준 벡터 전수는 다루지 않는다.
    #[test]
    fn sha256_표준_형식의_소문자_hex_64자를_반환한다() {
        let empty = content_hash(b"");
        assert_eq!(
            empty,
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
    }
}
