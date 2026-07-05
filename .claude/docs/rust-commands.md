# Rust 커맨드 계약 (파일 I/O · IPC 경계)

파일 I/O와 OS 접근은 전부 Rust 커맨드로 내린다. 웹뷰는 이 커맨드들을 `invoke`로만 호출하고, 직접 파일시스템을 만지지 않는다(→ [아키텍처](architecture.md)). 이 문서는 커맨드 시그니처와 권한 정책의 단일 출처다.

새 파일 커맨드는 **구현 전에 이 문서에 계약을 먼저 추가**한다.

## 커맨드 시그니처 (초안)

```rust
#[tauri::command]
async fn open_file(path: String) -> Result<FileContent, AppError>;
// FileContent { text: String, encoding: String, eol: String, mtime: u64 }

#[tauri::command]
async fn save_file(path: String, text: String, eol: String) -> Result<SaveResult, AppError>;
// SaveResult { mtime: u64 }

#[tauri::command]
async fn read_dir_tree(root: String, depth: u32) -> Result<Vec<TreeNode>, AppError>;
// TreeNode { path, name, kind: "dir"|"file", children? }
// depth: 한 번에 읽을 깊이 (거대 트리는 레벨별 lazy 로딩 → document-model.md)

#[tauri::command]
async fn watch_paths(paths: Vec<String>) -> Result<(), AppError>;
// 외부 변경 시 프론트로 이벤트 emit (아래 이벤트 계약 참조)

#[tauri::command]
async fn show_open_dialog() -> Result<Option<String>, AppError>;

#[tauri::command]
async fn show_save_dialog(default_name: String) -> Result<Option<String>, AppError>;
```

## 이벤트 계약 (Rust → 웹뷰)

```text
file-changed   { path, mtime }   외부에서 파일이 수정됨 → 프론트가 리로드/충돌 처리
file-removed   { path }          열려 있던 파일이 삭제/이동됨
```

외부 변경 처리 정책(리로드·충돌 안내)의 단일 출처는 [파일 생명주기 정책](file-lifecycle.md).

## 원칙

- **본문은 저장/열기 시점에만 오간다.** 키 입력마다 `save_file`을 호출하지 않는다. dirty 추적은 웹뷰에서 한다(→ [문서 모델](document-model.md)).
- 커맨드는 실패를 `AppError`로 명시 반환한다. 파일 없음·권한 없음·디스크 꽉 참 등을 사용자에게 피드백할 수 있게 한다.
- 커맨드 인자·반환 타입은 **tauri-specta**로 Rust→TS 타입을 생성해, 프론트와의 직렬화·`AppError` 매핑 계약 드리프트를 컴파일 타임에 차단한다(→ [테스트 전략](testing.md)).
- 인코딩은 UTF-8 확정, 개행은 파일의 기존 EOL을 유지한다(→ [파일 생명주기 정책](file-lifecycle.md)).

## 구현 크레이트·플러그인

버전은 [기술 스택](tech-stack.md#rust-크레이트-백엔드)을 단일 출처로 둔다.

```text
serde / serde_json   커맨드 인자·반환의 직렬화
thiserror            AppError 정의 (→ error-handling.md)
notify               파일 외부 변경 감시(watch_paths)
encoding_rs          인코딩 처리 (UTF-8·BOM)
plugin-dialog        show_open_dialog / show_save_dialog
plugin-store         설정·세션 상태 저장 (→ document-model.md)
plugin-log           통합 로깅 (→ error-handling.md)
```

파일 열기/저장·트리 읽기는 표준 `std::fs`(+`encoding_rs`) 기반 커스텀 커맨드로 구현하고, 다이얼로그만 `plugin-dialog`를 쓴다.

## 권한 (Capabilities)

**중요 — capabilities만으로는 경로가 제한되지 않는다.** 파일 I/O는 위 §구현처럼 커스텀 `std::fs` 커맨드다. Tauri capabilities가 강제하는 것은 (1) 프론트가 호출 가능한 **커맨드 목록**, (2) **플러그인(dialog·store 등)의 권한 스코프**뿐이다 — 커스텀 `std::fs` 커맨드가 **어떤 경로를 읽고 쓰는지는 제한하지 못한다.** 따라서 경로 스코프는 **두 층**으로 지킨다.

```text
1. Capabilities (apps/desktop/src-tauri/capabilities/)
   - 프론트가 부를 수 있는 커맨드 · plugin-dialog/store 권한을 명시 선언
   - 불필요한 플러그인·커맨드 노출 차단

2. 커맨드 내부 경로 검증  ← 실제 스코프 강제는 여기 있다
   - open/save/read_dir_tree는 요청 경로를 canonicalize(정규화)한 뒤
   - Rust가 보유한 "허용 루트 목록"(다이얼로그 선택분 · 연 루트 폴더)의
     하위인지 확인, 아니면 AppError로 거부
   - canonicalize로 심볼릭 링크를 통한 스코프 탈출도 차단
```

허용 스코프는 "다이얼로그로 선택한 경로"와 "연 루트 폴더의 하위 트리"이고, 임의 전역 접근은 지양한다. 마크다운 에디터는 임의 경로 파일을 열어야 하므로 이렇게 좁혀 최소 권한을 지키되, **그 강제는 capabilities가 아니라 커맨드 코드**에 있음을 잊지 않는다.
