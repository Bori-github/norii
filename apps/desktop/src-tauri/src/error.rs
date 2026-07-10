//! AppError — 파일 커맨드의 명시적 실패 타입.
//! 종류 목록의 단일 출처: .claude/docs/error-handling.md. 프론트는 kind로 구분된 메시지를 만든다.

use serde::Serialize;

/// 커맨드 실패의 종류. `{ kind, message }`로 직렬화되어 shared/ipc가 정규화한다.
#[derive(Debug, thiserror::Error, Serialize, specta::Type)]
#[serde(tag = "kind", content = "message", rename_all = "camelCase")]
pub enum AppError {
    #[error("파일을 찾을 수 없습니다: {0}")]
    NotFound(String),
    #[error("권한이 없습니다: {0}")]
    Permission(String),
    #[error("외부 변경 충돌: {0}")]
    Conflict(String),
    #[error("디스크 공간이 부족합니다: {0}")]
    DiskFull(String),
    #[error("인코딩 오류: {0}")]
    Encoding(String),
    #[error("I/O 오류: {0}")]
    Io(String),
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        use std::io::ErrorKind;
        let message = err.to_string();
        match err.kind() {
            ErrorKind::NotFound => AppError::NotFound(message),
            ErrorKind::PermissionDenied => AppError::Permission(message),
            ErrorKind::StorageFull | ErrorKind::QuotaExceeded => AppError::DiskFull(message),
            _ => AppError::Io(message),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // 왜: 프론트(shared/ipc)는 { kind, message } 형태를 전제로 에러를 정규화한다
    //     (→ .claude/docs/error-handling.md#프론트--에러-바운더리--ipc-정규화).
    // 보장: 직렬화 형태가 바뀌면 이 테스트가 깨져 프론트 계약 드리프트를 잡는다.
    // 경계: 각 variant의 메시지 문구 자체는 검증하지 않는다(문구는 자유).
    #[test]
    fn app_error_는_kind_message_형태로_직렬화된다() {
        let json = serde_json::to_value(AppError::Conflict("hash mismatch".into())).unwrap();
        assert_eq!(json["kind"], "conflict");
        assert_eq!(json["message"], "hash mismatch");
    }

    // 왜: 사용자는 "권한 없음"과 "디스크 부족"을 구분된 메시지로 받아야 한다
    //     (→ error-handling.md — 실패 종류 구분).
    // 보장: OS io::Error 종류가 대응되는 AppError variant로 매핑된다.
    // 경계: 나열되지 않은 ErrorKind는 모두 Io로 흡수된다 — 세분화는 검증하지 않는다.
    #[test]
    fn io_error_종류가_apperror_로_매핑된다() {
        use std::io::{Error, ErrorKind};
        assert!(matches!(
            AppError::from(Error::new(ErrorKind::NotFound, "x")),
            AppError::NotFound(_)
        ));
        assert!(matches!(
            AppError::from(Error::new(ErrorKind::PermissionDenied, "x")),
            AppError::Permission(_)
        ));
        assert!(matches!(
            AppError::from(Error::new(ErrorKind::StorageFull, "x")),
            AppError::DiskFull(_)
        ));
        assert!(matches!(
            AppError::from(Error::new(ErrorKind::BrokenPipe, "x")),
            AppError::Io(_)
        ));
    }
}
