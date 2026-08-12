# Rust 커맨드 계약 (파일 I/O · IPC 경계)

파일 I/O와 OS 접근은 전부 Rust 커맨드로 내린다. 웹뷰는 이 커맨드들을 `invoke`로만 호출하고, 직접 파일시스템을 만지지 않는다(→ [아키텍처](architecture.md)). 이 문서는 커맨드 시그니처와 권한 정책의 단일 출처다.

새 파일 커맨드는 **구현 전에 이 문서에 계약을 먼저 추가**한다.

## 커맨드 시그니처

### 파일 열기·저장

```rust
#[tauri::command]
async fn open_file(path: String, encoding_override: Option<String>) -> Result<FileContent, AppError>;
// FileContent { path: String, text: String, encoding: String, has_bom: bool,
//               eol: Eol, eol_mixed: bool, mtime: u64, hash: String }
// - path는 canonicalize된 정식 경로다 — 심볼릭 링크를 끝까지 해소하고 디스크에 실제로
//   기록된 표기(대소문자·유니코드 형태)로 수렴한 값. 같은 파일은 어떤 별칭
//   (/tmp↔/private/tmp · 대소문자 · NFC/NFD)으로 요청해도 같은 문자열이 나온다.
//   프론트는 탭 신원(Tab.filePath)·중복 탭 판정·감시 선언을 요청 문자열이 아니라
//   전부 이 값으로 통일한다(→ document-model.md#다중-탭-규칙)
// - text는 항상 UTF-8. 비UTF-8(EUC-KR 등)은 감지 후 변환해 반환하고,
//   encoding에 감지된 원본 인코딩("utf-8"|"euc-kr"…)을 담는다 (파이프라인 → file-lifecycle.md)
// - encoding_override 지정 시 파이프라인 전 단계(BOM 스니핑 포함)를 건너뛰고 전체 바이트를
//   그 인코딩으로 디코드한다(수동 재해석, "Reopen with Encoding"류). 이름은 WHATWG 라벨
//   ("euc-kr"·"utf-16le" 등, encoding_rs 표준) — 알 수 없는 라벨은 AppError::Encoding.
//   None이면 파이프라인이 판정한다
// - BOM은 text에서 제거하고 has_bom으로 알린다
// - eol은 다수결로 판정한 Eol("lf"|"crlf" 열거형, 동률이면 lf). eol_mixed는 원본 개행이
//   판정 결과와 완전히 일치하지 않음(혼합·CR-only) — 저장 시 재작성되므로 정규화 승인 대상
//   (→ file-lifecycle.md)
// - hash는 디스크 바이트의 내용 해시 — 에코 억제·충돌 검사의 기준값 (→ file-lifecycle.md)

#[tauri::command]
async fn save_file(path: String, text: String, eol: Eol, has_bom: bool,
                   expected_hash: Option<String>) -> Result<SaveResult, AppError>;
// SaveResult { path: String, mtime: u64, hash: String }
// - path는 저장이 실제로 쓴 대상의 canonical 경로다(새 파일은 부모를 canonicalize하고
//   파일명을 붙인다). Untitled 첫 저장·다른 이름 저장의 탭 신원도 다이얼로그가 준
//   문자열이 아니라 이 값으로 확정한다(open_file의 path와 같은 신원 규칙)
// - 항상 UTF-8로 쓴다. has_bom=true면 BOM을 다시 붙인다(원본 유지)
// - 경로를 canonicalize해 심볼릭 링크의 "실제 대상"에 저장한다(링크를 일반 파일로 교체하지 않음)
// - 원자적 쓰기: 대상과 같은 디렉터리의 임시 파일에 쓰고 원본 권한을 복사한 뒤 rename
// - 대상 파일이 읽기 전용(쓰기 권한 없음)이면 쓰지 않고 AppError::Permission으로 거부
//   (rename은 파일 잠금을 우회하므로 명시적으로 검사 → file-lifecycle.md)
// - 디스크 내용 해시 ≠ expected_hash면 쓰지 않고 AppError::Conflict 반환
//   (외부 변경 충돌. 새 파일·강제 덮어쓰기는 None. mtime은 세분성 문제로 기준으로 쓰지 않는다)
// - expected_hash가 있는데 파일이 디스크에 없어도 Conflict다 — 기준으로 삼은 원본이 사라진 것도 외부 변경이다
```

### 트리 읽기

```rust
#[tauri::command]
async fn read_dir(dir: String) -> Result<Vec<TreeNode>, AppError>;
// TreeNode { path, name, kind: "dir"|"file", is_symlink: bool }
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
// - 항목 단위 부분 실패 허용: 나열 중 개별 항목의 조회가 실패하면(경합 삭제 등) 그 항목만
//   건너뛴다 — 이 커맨드는 "폴더가 바뀌는 중"(dir-changed 직후)에 불리므로 경합이 일상이고,
//   항목 하나의 사정이 목록 전체를 죽이면 트리가 조용히 낡는다(watch_paths와 동일 원칙)
// - 심볼릭 링크: is_symlink로 표시하고 일반 항목처럼 다룬다.
//   대상이 없는(깨진) 링크도 표시하며, 열면 AppError::NotFound.
//   루트 밖을 가리키는 링크는 펼칠 때 canonicalize 스코프 검증이 거부한다(→ 권한)
```

### 항목 조작

```rust
#[tauri::command]
async fn create_file(dir: String, name: String) -> Result<String, AppError>;
// 빈 마크다운 파일을 만들고 만들어진 파일의 canonical 경로를 반환한다(프론트는 이 값으로
// 탭을 연다 — open_file과 같은 신원 규칙).
// - dir는 canonicalize 후 허용 루트 검증. 디렉터리가 아니면 AppError::Io
// - name은 아래 §항목 이름 규칙으로 검증하고(위반은 InvalidName) 확장자를 .md로 수렴한다
// - 같은 이름이 이미 있으면 AppError::AlreadyExists — 존재 확인과 생성 사이의 경합이
//   덮어쓰기가 되지 않게 create_new로 원자적으로 만든다
// - 내용은 빈 문자열이다(템플릿을 넣지 않는다)

#[tauri::command]
async fn create_dir(dir: String, name: String) -> Result<String, AppError>;
// 새 폴더. 규칙은 create_file과 같고 확장자 수렴만 없다.

#[tauri::command]
async fn rename_entry(path: String, new_name: String) -> Result<String, AppError>;
// 같은 부모 안에서 이름만 바꾼다(다른 폴더로 옮기지 않는다 — 이름에 '/'가 금지된다).
// 바뀐 항목의 canonical 경로를 반환한다.
// - 새 경로는 같은 부모 아래라 스코프가 유지된다
// - 파일이면 확장자를 .md로 수렴하고, 디렉터리면 이름 그대로다
// - 대상 이름이 이미 있으면 AlreadyExists — rename은 조용히 덮어쓰므로 먼저 막는다.
//   단 대소문자만 바꾸는 이름변경(a.md → A.md)은 허용한다: 대소문자를 무시하는
//   파일시스템(APFS 기본)에서 "이미 있음"으로 보이지만 원본과 같은 항목이다 —
//   같은 항목인지는 inode로 판정한다(macOS realpath는 대소문자를 교정하지 않아
//   해소한 경로를 비교하면 자기 자신을 남으로 본다)

#[tauri::command]
async fn delete_entry(path: String) -> Result<(), AppError>;
// 휴지통으로 보낸다 — 디스크에서 지우지 않는다(되돌릴 수 있게. 확인 모달은 프론트가 띄운다).
// - 폴더는 하위 전체가 함께 간다
// - 휴지통으로 보낼 수 없는 환경(지원하지 않는 볼륨 등)은 AppError::Io로 실패하고 완전
//   삭제로 대체하지 않는다 — 되돌릴 수 없는 삭제는 사용자가 고른 정책이 아니다

// 네 커맨드 모두 트리를 직접 갱신하지 않는다 — 자기 변경도 watch_tree의 dir-changed로
// 돌아와 반영된다(외부 변경과 같은 경로. 프론트에 낙관적 갱신을 두지 않는다)

// 스코프 검증은 넷 다 부모 디렉터리를 canonicalize해서 한다 — 항목 이름은 해소하지 않는다.
// rename_entry·delete_entry가 심볼릭 링크를 만나면 링크 자체를 다룬다는 뜻이다(대상이 아니라).
// 트리가 링크를 항목으로 보여주므로(read_dir), 링크를 지웠는데 대상이 사라지면 보이는 것과
// 어긋난다. 이름은 '/'를 포함할 수 없어(§항목 이름 규칙) 부모 밖으로 나갈 수 없다
```

### 변경 감시

```rust
#[tauri::command]
async fn watch_paths(paths: Vec<String>) -> Result<u32, AppError>;
// 감시 대상 전체를 선언적으로 교체한다(누적 아님) — 호출 시 이전 감시는 모두 해제.
// 탭 목록이 바뀔 때마다 열린 경로 전체를 다시 선언하므로 별도 unwatch 커맨드가 없다.
// 반환값은 "건너뛴 경로 수"다 — 0이면 선언이 완전히 성립했고, >0이면 일부가 감시되지
// 않았다. 프론트는 >0일 때 선언 캐시를 무효화해 다음 탭 변화에서 재시도한다(일시적
// 사유로 건너뛴 경로가 영구 미감시로 고착되지 않게).
// 구현(계약): 파일이 아니라 부모 디렉터리를 감시하고 경로로 필터한다 — 외부 에디터의
// 원자적 저장(rename 교체)에도 감시가 끊기지 않는다(VS Code와 동일 전략).
// 삭제 감지는 짧은 유예(100ms) 후 존재를 재확인한다 — 다시 존재하면 file-changed,
// 정말 없으면 그때 file-removed (원자적 저장의 순간 삭제를 삭제로 오판하지 않음)
// 부분 실패 허용: 해석·구독에 실패한 경로(부모 삭제 등)는 건너뛰고 나머지를 감시한다 —
// 탭 하나의 사정이 전체 감시를 죽이면 안 된다. 건너뜀은 로그와 반환값으로 알린다.
// 스코프 위반(허용 루트 밖)은 전체를 AppError::Permission으로 거부한다 — 정상 흐름에선
// 도달 불가한 경로라 보안 신호다. 단, 이 판정은 해석(canonicalize)이 성공한 경로에만
// 가능하다 — 해석이 실패한 경로는 스코프를 판정할 수 없어 건너뜀으로 처리된다(감시하지
// 않으므로 스코프가 넓어지지는 않는다).
// 새 감시를 만든 뒤에만 이전 감시를 교체한다 — 교체 실패가 무감시 상태를 남기지 않는다.
// 이벤트 코얼레싱: 같은 경로의 연속 이벤트는 짧은 창(50ms)으로 합쳐 1회만 확인한다 —
// 외부 도구의 연속 쓰기가 이벤트 수 × 파일 크기만큼 읽기를 증폭시키지 않게(성능 규칙).
// 알려진 한계: 확인 대기(50ms) 중에 감시가 교체되면 그 확인은 버려진다 — 교체와 겹친
// 외부 변경 하나가 유실될 수 있고, 다음 이벤트 또는 저장 직전 해시 검사가 보정한다.
// 외부 변경 시 프론트로 이벤트 emit (아래 이벤트 계약 참조)

#[tauri::command]
async fn watch_tree(root: Option<String>) -> Result<(), AppError>;
// 사이드바 루트의 "재귀" 감시를 선언적으로 교체한다(None = 감시 해제). 트리의 외부
// 생성/삭제/이름변경을 반영하기 위한 감시로, 열린 파일의 watch_paths와 별개다.
// root는 canonicalize 후 허용 루트 검증을 거친다(스코프 위반은 Permission).
// 이벤트: dir-changed { dir } — 그 디렉터리 "한 단계"의 구성이 바뀌었을 수 있다.
//   dir는 변경 항목의 부모 디렉터리다(감시가 canonical 루트 기준이라 이벤트 경로도
//   canonical — 트리 노드 경로와 그대로 대조된다). 반영 정책(읽어 둔 폴더만 재읽기·병합)은
//   document-model.md#파일-트리-사이드바가 단일 출처다.
// 숨김 필터: 루트 아래에서 '.'로 시작하는 컴포넌트를 지나는 경로의 이벤트는 무시한다
//   (.git·에디터 임시 파일의 이벤트 폭주 방지 — 트리가 숨김 항목을 표시하지 않으므로
//   구성 변화도 아니다).
// 파일 내용 수정(Modify Data/Metadata)·Access 이벤트는 무시한다 — 목록 구성이 변하지
//   않는 사건이다. 생성·삭제·이름변경(+분류 불명 이벤트)만 알린다.
// 코얼레싱: 같은 dir의 연속 이벤트는 짧은 창(200ms)으로 합쳐 1회만 알린다 — git
//   checkout류 대량 변경이 이벤트 수만큼 read_dir 재읽기를 증폭시키지 않게 한다.
// 새 감시가 준비된 뒤에만 이전 감시를 교체한다(watch_paths와 동일 — 무감시 창 없음).
// 감시 백엔드 오류(이벤트 큐 넘침·rescan 요구 등)는 tree-desynced로 발신한다 — 어떤
//   변경을 놓쳤는지 특정할 수 없으므로, 프론트는 읽어 둔 모든 레벨을 다시 읽어 병합한다
//   (읽어 둔 폴더는 펼침이 캐시를 쓰므로 이 신호 없이는 보정 경로가 없다).
// 알려진 한계: 루트 자체가 밖에서 삭제되면 감시가 조용히 끝날 수 있다 — 다음 폴더
//   열기가 새 감시를 등록한다.
```

### 다이얼로그

```rust
#[tauri::command]
async fn show_open_dialog() -> Result<Option<String>, AppError>;

#[tauri::command]
async fn show_save_dialog(default_name: String, start_dir: Option<String>) -> Result<Option<String>, AppError>;
// 두 다이얼로그 모두 Markdown 필터(.md·.markdown — read_dir 필터와 동일 집합)를 걸고,
// 취소하면 None을 반환한다. 선택된 경로는 허용 루트로 등록된다(→ 권한)
// start_dir가 존재하는 디렉터리면 다이얼로그가 거기서 시작하고, 이때 default_name은 파일명
// 기본값으로 제안되지 않는다(rfd 제약 → dialog_commands.rs). start_dir이 없으면 OS가 정한
// 위치에서 열고 default_name을 제안한다. 웹뷰는 사이드바 루트를 넘긴다(폴더를 열지 않았으면
// None). 시작 위치일 뿐 허용과 무관하다 — 허용 루트 등록은 사용자가 선택한 경로로만 한다

#[tauri::command]
async fn show_open_folder_dialog() -> Result<Option<String>, AppError>;
// 폴더 선택 다이얼로그 — 사이드바 루트(rootDir)를 여는 입구(→ document-model.md#파일-트리-사이드바).
// 취소하면 None. 선택한 폴더는 허용 루트로 등록된다(하위 트리 전체 — read_dir·open·save가 통과)

// 세 다이얼로그 모두 반환 경로는 canonicalize된 정식 경로다 — 탭·트리가 쓰는 신원 규칙
// (open_file의 path)과 같은 표기로 시작하게 한다
```

### 창 표면

```rust
#[tauri::command]
fn set_window_blur_radius(window: tauri::WebviewWindow, radius: u32);
// 창 뒤 흐림 반경을 다시 건다 — 설정 화면이 부른다. 허용 범위·기본값은 창 표면 계약이
// 소유하고(→ design/window-chrome.md#계약--흐림-반경), 범위 밖 값은 그 하한·상한으로 자른다.
// 자른 값이 지금 걸린 반경과 같으면 OS를 부르지 않는다 — 슬라이더를 끄는 동안 매 프레임
// 윈도서버 왕복이 나가지 않게 한다.
// macOS 밖에서는 무동작이다. 흐림 호출이 실패해도 경고 로그만 남기고 성공을 반환한다.
```

### 세션

```rust
#[tauri::command]
async fn load_session() -> Result<Option<Session>, AppError>;
// 지난 세션을 읽고, 그 안의 경로(루트 폴더·탭)를 허용 루트로 등록한다 — 재시작 뒤에도
// 다이얼로그 없이 그 파일을 열 수 있게 하는 유일한 통로다(→ 권한).
// 파일이 없거나 JSON이 깨졌으면 None — 손으로 고칠 수 있는 파일이라 읽기 실패는 오류가 아니다.
// 지금 없는 경로(밖에서 지웠거나 옮긴 파일)는 아래 표의 종류와 어긋난 경로와 함께
//   결과에서 빠지고 허용되지도 않는다.
// 활성 탭이 걸러지면 active는 빈다 — 프론트가 남은 첫 탭을 활성으로 만든다(→ document-model.md#세션-복원).

#[tauri::command]
async fn save_session(session: Session) -> Result<(), AppError>;
// 지금 세션을 덮어쓴다(원자적 쓰기). 이미 허용된 경로만 기록한다 — 웹뷰가 넘긴 경로가
// 다음 부팅의 허용 루트가 되는 길을 막는다.

struct Session {
  root_dir: Option<String>,   // 사이드바 루트. 없으면 폴더를 열지 않은 세션
  tabs: Vec<SessionTab>,      // 경로 있는 탭만 — Untitled는 복원 대상이 아니다
  active: Option<u32>,        // 활성 탭의 tabs 인덱스
  recent_files: Vec<String>,  // 최근 파일, 최신이 앞 — 갱신 시점·상한은
                              //   document-model.md#최근-파일이 소유한다.
                              //   필드가 없는 옛 세션 파일은 빈 목록으로 읽는다
}

struct SessionTab {
  path: String,               // canonical 경로 — 탭 신원 규칙과 같다(→ open_file)
  cursor_line: u32,           // 커서 줄(1-기반)
  cursor_column: u32,         // 커서 칸(1-기반) — 1·1이면 문서 처음
  scroll_line: u32,           // 뷰포트 상단 라인(1-기반). 1이면 맨 위
}
```

**경로 자리마다 종류가 정해져 있다.** 허용은 하위 트리 전체를 열기 때문이다 — 탭 자리에 디렉터리가 오면 문서 하나가 아니라 그 폴더 전체가 열린다.

```text
자리            종류        허용하면 열리는 범위
root_dir        디렉터리    그 폴더 아래 전부
tabs[].path     파일        그 파일 하나
recent_files[]  파일        그 파일 하나
```

`canonicalize` 후의 실제 종류로 판정한다 — 문서처럼 보이지만 디렉터리를 가리키는 심볼릭 링크도 탭 자리에서 거부된다.

저장 위치는 앱 config 디렉터리의 `session.json`이다. 복원 시점·복원 대상의 정책은 [문서 모델 — 세션 복원](document-model.md#세션-복원)이 소유한다.

## 항목 이름 규칙 (create_file · create_dir · rename_entry)

이름은 "한 항목의 이름"이지 경로가 아니다. 아래를 어기면 `AppError::InvalidName`이다.

```text
- 앞뒤 공백을 트림한 뒤 판정한다. 트림 결과가 비면 거부
- 경로 구분자('/')·NUL·제어문자를 포함하면 거부 — 이름으로 다른 폴더에 손대지 못하게 한다
- '.'으로 시작하면 거부 — 트리가 숨김 항목을 표시하지 않아 만들자마자 사라진다
  ('.'과 '..'도 이 규칙에 걸린다)
```

**확장자 수렴(파일에만)** — 이름이 `.md`/`.markdown`(대소문자 무시)으로 끝나지 않으면 `.md`를 덧붙인다. 트리가 `.md`/`.markdown`만 표시하므로(위 `read_dir` 필터), 보정하지 않으면 방금 만든 파일이 트리에서 보이지 않는다.

프론트도 입력 중에 같은 규칙을 판정해 확정을 막지만(즉시 피드백), **거부의 강제는 여기다** — 웹뷰를 우회한 IPC 직접 호출도 이 검증을 지난다.

## 이벤트 계약 (Rust → 웹뷰)

```text
file-changed   { path, mtime, hash }   외부에서 파일이 수정됨 (hash는 이벤트 처리 시점의 디스크 내용 해시)
file-removed   { path }                열려 있던 파일이 삭제/이동됨
dir-changed    { dir }                 트리 감시(watch_tree) — dir 한 단계의 구성이 바뀌었을 수 있음
tree-desynced  {}                      트리 감시 — 백엔드가 이벤트를 놓침. 읽어 둔 레벨 전체 재읽기 신호
```

자기 저장도 `file-changed`를 발생시킨다 — 프론트는 이벤트의 hash가 탭의 `lastSavedHash`와 같으면 자기 에코로 무시한다. 이 규칙과 외부 변경 처리 정책(리로드·충돌 안내)의 단일 출처는 [파일 생명주기 정책](file-lifecycle.md).

## 원칙

- **본문은 저장/열기 시점에만 오간다.** 키 입력마다 `save_file`을 호출하지 않는다. dirty 추적은 웹뷰에서 한다(→ [문서 모델](document-model.md)).
- 커맨드는 실패를 `AppError`로 명시 반환한다. 파일 없음·권한 없음·디스크 꽉 참 등을 사용자에게 피드백할 수 있게 한다.
- 커맨드 인자·반환 타입은 **tauri-specta**로 Rust→TS 타입을 생성해, 프론트와의 직렬화·`AppError` 매핑 계약 드리프트를 컴파일 타임에 차단한다(→ [테스트 전략](testing.md)).
- 필드 표기: Rust 구조체는 snake_case, TS 타입은 camelCase다 — serde `rename_all = "camelCase"`로 직렬화를 통일하고 tauri-specta가 이를 TS에 반영한다(예: `eol_mixed` ↔ `eolMixed`).
- 저장 인코딩은 항상 UTF-8(비UTF-8은 열 때 변환), 개행은 판정된 EOL을 유지한다(→ [파일 생명주기 정책](file-lifecycle.md)).

## 구현 크레이트·플러그인

버전은 [기술 스택](tech-stack.md)을 단일 출처로 둔다 — 크레이트는 Rust 크레이트 표, `plugin-*`은 Tauri 플러그인 표가 소유한다.

```text
serde / serde_json   커맨드 인자·반환의 직렬화
thiserror            AppError 정의 (→ error-handling.md)
notify               파일 외부 변경 감시(watch_paths)
trash                삭제를 휴지통 이동으로(delete_entry)
encoding_rs          인코딩 변환 (레거시 → UTF-8, BOM)
chardetng            인코딩 감지 (→ file-lifecycle.md 열기 파이프라인)
plugin-dialog        show_open_dialog / show_save_dialog
plugin-store         설정 저장(→ file-lifecycle.md#설정-저장)
plugin-log           통합 로깅 (→ error-handling.md)
```

파일 열기/저장·트리 읽기는 표준 `std::fs`(+`encoding_rs`) 기반 커스텀 커맨드로 구현하고, 다이얼로그만 `plugin-dialog`를 쓴다.

## 권한 (Capabilities)

**중요 — capabilities만으로는 경로가 제한되지 않는다.** 파일 I/O는 위 §구현처럼 커스텀 `std::fs` 커맨드다. Tauri capabilities가 강제하는 것은 (1) 프론트가 호출 가능한 **커맨드 목록**, (2) **플러그인(dialog·store 등)의 권한 스코프**뿐이다 — 커스텀 `std::fs` 커맨드가 **어떤 경로를 읽고 쓰는지는 제한하지 못한다.** 따라서 경로 스코프는 **두 층**으로 지킨다.

```text
1. Capabilities (apps/desktop/src-tauri/capabilities/)
   - 프론트가 부를 수 있는 커맨드 · plugin-dialog·plugin-store 권한을 명시 선언
   - 불필요한 플러그인·커맨드 노출 차단

2. 커맨드 내부 경로 검증  ← 실제 스코프 강제는 여기 있다
   - open/save/read_dir는 요청 경로를 canonicalize(정규화)한 뒤
   - Rust가 보유한 "허용 루트 목록"(다이얼로그 선택분 · 연 루트 폴더 ·
     load_session이 읽은 지난 세션의 경로)의 하위인지 확인, 아니면 AppError로 거부
   - canonicalize로 심볼릭 링크를 통한 스코프 탈출도 차단
```

**허용 루트는 웹뷰가 선언하지 못한다.** 세 입구(다이얼로그 · 폴더 열기 · `load_session`) 모두 경로가 Rust 쪽에서 온다 — 다이얼로그는 OS가, 세션은 Rust가 직접 읽은 자기 파일이 준다. 세션 파일에 기록되는 경로도 그때 이미 허용된 것만이라(→ `save_session`), 웹뷰가 임의 경로를 넣어 다음 부팅에서 권한을 얻는 길이 없다.

**그래서 앱 자신의 config 디렉터리는 파일 커맨드가 만질 수 없다.** 사용자가 홈 폴더를 열면 그 디렉터리도 허용 루트 하위가 된다 — 세션 파일을 `save_file`로 고칠 수 있으면 웹뷰가 임의 경로를 다음 부팅의 허용 루트로 심을 수 있다. 그 디렉터리는 허용보다 강한 거부 목록에 들어간다(`FileScope::deny`, setup에서 등록). 세션 파일을 신뢰하는 범위는 [보안 — 세션 파일](security.md#세션-파일)이 소유한다.

**이미지 권한(asset 프로토콜)** — 프리뷰의 로컬 이미지는 Tauri asset 프로토콜로 읽는다. 이 경로는 Tauri가 스코프 객체로 검사한다.

설정은 `tauri.conf.json`의 `app.security.assetProtocol`이다.

- 허용 경로는 위 세 입구에서 런타임에 정해지므로 `scope`에 미리 적을 경로가 없다.
- `scope`는 객체로 적고 `requireLiteralLeadingDot: false`를 넣는다. 이 필드는 객체 형태에만 있고 unix 기본값은 `true`다([`FsScope`](https://docs.rs/tauri-utils/latest/tauri_utils/config/enum.FsScope.html)). 생략하면 `.`으로 시작하는 폴더 안의 파일이 허용 글롭에 걸리지 않아, `.이미지/사진.png`를 파일 커맨드는 통과시키고 이미지만 거부한다.

`FileScope`의 허용·거부는 asset 스코프에도 등록한다.

| `FileScope` 등록 | asset 스코프에 등록하는 경로 |
|---|---|
| 폴더 허용 | 그 폴더의 하위 트리 전체 |
| 파일 허용 | 그 파일이 있는 폴더의 하위 트리 전체 (부모가 파일시스템 루트면 그 파일만) |
| 디렉터리 거부 | 같은 디렉터리를 거부로 등록 (허용보다 강하다) |

파일 허용에서만 두 스코프가 갈라진다. 이 차이로 생기는 위험은 [보안 — 이미지](security.md#이미지-asset-프로토콜)에 있다. 그 밖에서 갈라지면 파일 커맨드가 막는 경로를 이미지로 읽을 수 있으므로, 두 스코프의 일치는 테스트로 검증한다.

**외부 링크 권한** — 프리뷰의 링크를 OS 기본 브라우저로 넘기기 위해 `opener:allow-open-url`만 연다(`opener:default`가 함께 주는 파일·경로 열기 권한은 두지 않는다 — 문서가 로컬 파일을 열게 할 이유가 없다). **허용 스킴 집합은 [보안 — 외부 링크](security.md#4-외부-링크-프리뷰에서-문서-밖으로-나가는-유일한-통로)** 를 단일 출처로 둔다.

**여기서는 capabilities가 실제로 스코프를 강제한다** — 커스텀 `std::fs` 커맨드와 다른 점이다. 플러그인 커맨드라 Tauri가 스코프 객체를 검사하므로, 스킴을 `allow` 목록에 **URL 글롭으로 선언**해야 하고 **비워 두면 모든 URL이 거부된다**(`Not allowed to open url`). 그래서 허용 스킴이 설정(`capabilities/default.json`)과 코드(`features/open-link`) 두 곳에 존재하게 된다 — 설정은 Rust의 강제층(프론트를 우회한 IPC 직접 호출도 여기서 막힌다), 코드는 판정층(거부를 조용한 무동작으로 만든다)이다.

둘 중 하나만 고치면 링크가 조용히 죽거나(설정만 좁힘) 무의미한 에러 로그가 쌓인다(코드만 넓힘). capabilities는 설정 파일이라 타입체크·린트가 잡아주지 못하므로, **두 목록의 일치를 테스트가 지킨다**(`features/open-link/model/allowlist-drift.test.ts`).

**창 조작 권한** — 종료 방어가 쓰는 `allow-close`·`allow-destroy`, 테마 동기화가 쓰는 `allow-set-theme`(창의 타이틀바·신호등을 앱 테마에 맞춘다 → [창 표면 계약](design/window-chrome.md#창-테마-동기화)), 저장된 설정을 적용한 뒤 창을 보이는 `allow-show`(→ [창 표면 계약](design/window-chrome.md#부팅-순서--창은-언제-보이는가)) 넷이다. 모두 `core:default`에 없어 명시 선언한다. **창 드래그 권한은 두지 않는다** — 웹이 드래그를 요청하지 않기 때문이다. 상단은 웹뷰가 가지지만(`titleBarStyle: Overlay`), 그 위에 얹은 네이티브 드래그 띠가 AppKit 경로로 직접 처리한다(→ [창 표면 계약](design/window-chrome.md#계약--드래그-띠)).

허용 스코프는 "다이얼로그로 선택한 경로"와 "연 루트 폴더의 하위 트리"이고, 임의 전역 접근은 지양한다. 마크다운 에디터는 임의 경로 파일을 열어야 하므로 이렇게 좁혀 최소 권한을 지키되, **그 강제는 capabilities가 아니라 커맨드 코드**에 있음을 잊지 않는다.
