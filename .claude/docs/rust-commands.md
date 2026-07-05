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
async fn read_dir_tree(root: String) -> Result<Vec<TreeNode>, AppError>;
// TreeNode { path, name, kind: "dir"|"file", children? }

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

Tauri 2는 파일시스템 접근 범위를 capability 파일(`apps/desktop/src-tauri/capabilities/`)에 **명시적으로 선언**한다.

정책:

```text
허용 스코프:
  - 다이얼로그로 사용자가 선택한 경로
  - 사용자가 연 루트 폴더의 하위 트리

지양:
  - 임의 전역 파일시스템 접근
```

보안 트레이드오프: 마크다운 에디터는 임의 경로 파일을 열어야 하므로, "사용자가 명시적으로 연 것"으로 스코프를 좁혀 최소 권한 원칙을 지킨다.
