# Rust 커맨드 계약 (파일 I/O · IPC 경계)

파일 I/O와 OS 접근은 전부 Rust 커맨드로 내린다. 웹뷰는 이 커맨드들을 `invoke`로만 호출하고, 직접 파일시스템을 만지지 않는다(→ [아키텍처](architecture.md)). 이 문서는 커맨드 시그니처와 권한 정책의 단일 출처다.

새 파일 커맨드는 **구현 전에 이 문서에 계약을 먼저 추가**한다.

## 커맨드 시그니처 (초안)

```rust
#[tauri::command]
async fn open_file(path: String, encoding_override: Option<String>) -> Result<FileContent, AppError>;
// FileContent { text: String, encoding: String, has_bom: bool,
//               eol: String, eol_mixed: bool, mtime: u64, hash: String }
// - text는 항상 UTF-8. 비UTF-8(EUC-KR 등)은 감지 후 변환해 반환하고,
//   encoding에 감지된 원본 인코딩("utf-8"|"euc-kr"…)을 담는다 (파이프라인 → file-lifecycle.md)
// - encoding_override 지정 시 파이프라인 전 단계(BOM 스니핑 포함)를 건너뛰고 전체 바이트를
//   그 인코딩으로 디코드한다(수동 재해석, "Reopen with Encoding"류). 이름은 WHATWG 라벨
//   ("euc-kr"·"utf-16le" 등, encoding_rs 표준) — 알 수 없는 라벨은 AppError::Encoding.
//   None이면 파이프라인이 판정한다
// - BOM은 text에서 제거하고 has_bom으로 알린다
// - eol은 다수결로 판정한 "lf"|"crlf" (동률이면 lf). eol_mixed는 원본 개행이 판정 결과와
//   완전히 일치하지 않음(혼합·CR-only) — 저장 시 재작성되므로 정규화 승인 대상 (→ file-lifecycle.md)
// - hash는 디스크 바이트의 내용 해시 — 에코 억제·충돌 검사의 기준값 (→ file-lifecycle.md)

#[tauri::command]
async fn save_file(path: String, text: String, eol: String, has_bom: bool,
                   expected_hash: Option<String>) -> Result<SaveResult, AppError>;
// SaveResult { mtime: u64, hash: String }
// - 항상 UTF-8로 쓴다. has_bom=true면 BOM을 다시 붙인다(원본 유지)
// - 경로를 canonicalize해 심볼릭 링크의 "실제 대상"에 저장한다(링크를 일반 파일로 교체하지 않음)
// - 원자적 쓰기: 대상과 같은 디렉터리의 임시 파일에 쓰고 원본 권한을 복사한 뒤 rename
// - 대상 파일이 읽기 전용(쓰기 권한 없음)이면 쓰지 않고 AppError::Permission으로 거부
//   (rename은 파일 잠금을 우회하므로 명시적으로 검사 → file-lifecycle.md)
// - 디스크 내용 해시 ≠ expected_hash면 쓰지 않고 AppError::Conflict 반환
//   (외부 변경 충돌. 새 파일·강제 덮어쓰기는 None. mtime은 세분성 문제로 기준으로 쓰지 않는다)

#[tauri::command]
async fn read_dir(dir: String) -> Result<Vec<TreeNode>, AppError>;
// TreeNode { path, name, kind: "dir"|"file", is_symlink?: bool }
// (TS에는 rename_all=camelCase로 isSymlink로 노출 → 아래 원칙)
// 한 호출 = 그 폴더 "한 단계"의 항목 목록 (VS Code의 fetchChildren과 동일한 레벨별 lazy).
// 응답에 중첩이 없으므로 빈 폴더 = 빈 배열이고, 트리 조립과 "아직 안 읽음" 상태는
// 프론트 모델이 담당한다(→ document-model.md). 호출당 한 단계라 순환 심링크가 폭주할 수 없다.
// 반환 규칙(결정론 — 파일 처리 동작은 VS Code(MIT)를 참고, → ../rules/prior-art.md):
// - 필터: 디렉터리는 전부, 파일은 .md/.markdown만 (확장자 대소문자 무시)
// - 정렬: 디렉터리 우선 → 자연 정렬 → 동률이면 원본 이름의 코드포인트 비교로 확정.
//   자연 정렬: 이름을 숫자/비숫자 구간으로 분할해 숫자 구간은 수치 비교,
//   비숫자 구간은 대소문자 무시 코드포인트 비교 (2.md < 10.md)
// - 숨김 항목(이름이 '.'으로 시작)은 제외
// - 심볼릭 링크: is_symlink로 표시하고 일반 항목처럼 다룬다.
//   대상이 없는(깨진) 링크도 표시하며, 열면 AppError::NotFound.
//   루트 밖을 가리키는 링크는 펼칠 때 canonicalize 스코프 검증이 거부한다(→ 권한)

#[tauri::command]
async fn watch_paths(paths: Vec<String>) -> Result<(), AppError>;
// 감시 대상 전체를 선언적으로 교체한다(누적 아님) — 호출 시 이전 감시는 모두 해제.
// 탭 목록이 바뀔 때마다 열린 경로 전체를 다시 선언하므로 별도 unwatch 커맨드가 없다.
// 구현(계약): 파일이 아니라 부모 디렉터리를 감시하고 경로로 필터한다 — 외부 에디터의
// 원자적 저장(rename 교체)에도 감시가 끊기지 않는다(VS Code와 동일 전략).
// 삭제 감지는 짧은 유예(100ms) 후 존재를 재확인한다 — 다시 존재하면 file-changed,
// 정말 없으면 그때 file-removed (원자적 저장의 순간 삭제를 삭제로 오판하지 않음)
// 외부 변경 시 프론트로 이벤트 emit (아래 이벤트 계약 참조)

#[tauri::command]
async fn show_open_dialog() -> Result<Option<String>, AppError>;

#[tauri::command]
async fn show_save_dialog(default_name: String) -> Result<Option<String>, AppError>;
```

## 이벤트 계약 (Rust → 웹뷰)

```text
file-changed   { path, mtime, hash }   외부에서 파일이 수정됨 (hash는 이벤트 처리 시점의 디스크 내용 해시)
file-removed   { path }                열려 있던 파일이 삭제/이동됨
```

자기 저장도 `file-changed`를 발생시킨다 — 프론트는 이벤트의 hash가 탭의 `lastSavedHash`와 같으면 자기 에코로 무시한다. 이 규칙과 외부 변경 처리 정책(리로드·충돌 안내)의 단일 출처는 [파일 생명주기 정책](file-lifecycle.md).

## 원칙

- **본문은 저장/열기 시점에만 오간다.** 키 입력마다 `save_file`을 호출하지 않는다. dirty 추적은 웹뷰에서 한다(→ [문서 모델](document-model.md)).
- 커맨드는 실패를 `AppError`로 명시 반환한다. 파일 없음·권한 없음·디스크 꽉 참 등을 사용자에게 피드백할 수 있게 한다.
- 커맨드 인자·반환 타입은 **tauri-specta**로 Rust→TS 타입을 생성해, 프론트와의 직렬화·`AppError` 매핑 계약 드리프트를 컴파일 타임에 차단한다(→ [테스트 전략](testing.md)).
- 필드 표기: Rust 구조체는 snake_case, TS 타입은 camelCase다 — serde `rename_all = "camelCase"`로 직렬화를 통일하고 tauri-specta가 이를 TS에 반영한다(예: `eol_mixed` ↔ `eolMixed`).
- 저장 인코딩은 항상 UTF-8(비UTF-8은 열 때 변환), 개행은 판정된 EOL을 유지한다(→ [파일 생명주기 정책](file-lifecycle.md)).

## 구현 크레이트·플러그인

버전은 [기술 스택](tech-stack.md#rust-크레이트-백엔드)을 단일 출처로 둔다.

```text
serde / serde_json   커맨드 인자·반환의 직렬화
thiserror            AppError 정의 (→ error-handling.md)
notify               파일 외부 변경 감시(watch_paths)
encoding_rs          인코딩 변환 (레거시 → UTF-8, BOM)
chardetng            인코딩 감지 (→ file-lifecycle.md 열기 파이프라인)
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
   - open/save/read_dir는 요청 경로를 canonicalize(정규화)한 뒤
   - Rust가 보유한 "허용 루트 목록"(다이얼로그 선택분 · 연 루트 폴더)의
     하위인지 확인, 아니면 AppError로 거부
   - canonicalize로 심볼릭 링크를 통한 스코프 탈출도 차단
```

**창 조작 권한** — 종료 방어가 쓰는 `allow-close`·`allow-destroy`, 그리고 테마 동기화가 쓰는 `allow-set-theme`(창의 타이틀바·신호등을 앱 테마에 맞춘다 → [창 표면 계약](design/window-chrome.md#창-테마-동기화)) 셋뿐이다. 모두 `core:default`에 없어 명시 선언한다. **창 드래그 권한은 두지 않는다** — 타이틀바를 OS가 소유하므로 드래그도 OS가 한다.

허용 스코프는 "다이얼로그로 선택한 경로"와 "연 루트 폴더의 하위 트리"이고, 임의 전역 접근은 지양한다. 마크다운 에디터는 임의 경로 파일을 열어야 하므로 이렇게 좁혀 최소 권한을 지키되, **그 강제는 capabilities가 아니라 커맨드 코드**에 있음을 잊지 않는다.
