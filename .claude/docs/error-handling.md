# 에러 처리와 로깅

norii의 에러 처리·로깅 전략의 단일 출처다. **데이터 유실 방지가 최우선**이므로(→ [파일 생명주기 정책](file-lifecycle.md)), 실패를 삼키지 않고 사용자에게 명확히 전달한다.

## Rust — 타입이 있는 에러

파일 커맨드는 실패를 `Result<_, AppError>`로 명시 반환한다(→ [Rust 커맨드 계약](rust-commands.md)). `AppError`는 **`thiserror`** 로 정의해 실패 종류를 구분한다.

```text
AppError::NotFound       파일 없음
AppError::Permission     권한 없음
AppError::DiskFull       디스크 부족
AppError::Encoding       인코딩 오류
AppError::Io(...)        기타 I/O
```

프론트는 이 종류를 보고 사용자에게 **구분된 메시지**를 준다("권한이 없습니다" vs "디스크가 가득 찼습니다").

## 로깅 — tauri-plugin-log

Rust와 프론트 로그를 **`tauri-plugin-log`** 로 통합한다. 하나의 파이프라인으로 개발·디버깅·이슈 재현을 돕는다.

- 릴리스 빌드에서는 로그 레벨을 제한한다(예: `warn` 이상).
- **민감정보 주의**: 파일 경로·문서 내용·사용자 데이터를 로그에 남기지 않는다. 필요하면 마스킹한다.

## 프론트 — 에러 바운더리 + IPC 정규화

- **에러 바운더리**를 FSD `app` 레이어에 둔다(→ [프론트엔드 아키텍처](frontend-architecture.md)). 예상치 못한 렌더 에러가 앱 전체를 죽이지 않고 복구 UI를 보이게 한다.
- **IPC 실패 정규화**: `shared/ipc`가 Rust `AppError`를 프론트에서 다루기 쉬운 형태로 정규화한다. `features`는 정규화된 에러만 처리하고, `invoke` 실패를 곳곳에서 직접 다루지 않는다.

## 원칙

- **실패를 삼키지 않는다.** 특히 저장 실패는 사용자에게 명확히 알리고 재시도 경로를 준다(데이터 유실 직결).
- **자동 검증 불가 영역**은 그 이유와 수동 검증 방법을 남긴다(→ [작업 규칙](../rules/project-rules.md)).
- 로깅·에러 표면은 [보안](security.md)의 신뢰 경계와 민감정보 원칙을 함께 지킨다.
