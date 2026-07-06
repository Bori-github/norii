# 문서 모델 (다중 탭 + 파일 트리)

norii는 여러 문서를 탭으로 동시에 열고, 사이드바로 파일 트리를 구성한다. 이 문서는 그 상태 구조와 규칙의 단일 출처다.

설계 의도는 **"사이드바로 파일을 구조화하되, 본문은 블록 아웃라이너가 아니다"** 를 데이터 모델로 못박는 것이다. 사이드바는 파일 트리(파일시스템에 이미 있는 위계)이고, 본문은 자유 텍스트다.

## 상태 구조

```ts
interface Tab {
  id: string;
  filePath: string | null;      // null = 미저장 새 문서
  title: string;                // 파일명 또는 "Untitled"
  isDirty: boolean;             // 자동 저장 대기 중 여부 (→ file-lifecycle.md)
  sourceEncoding: string;       // 감지된 원본 인코딩. 'utf-8' 아니면 변환 배너 표시 (→ file-lifecycle.md)
  hasBom: boolean;              // 원본 BOM 유무 — 저장 시 그대로 유지
  eol: 'lf' | 'crlf';           // 판정된 EOL. 새 문서는 'lf' (→ file-lifecycle.md)
  eolMixed: boolean;            // 원본 개행이 판정 EOL과 불일치(혼합·CR-only) — 정규화 승인 대상 (→ file-lifecycle.md)
  lastSavedHash: string | null; // 열기/저장이 반환한 내용 해시 — 충돌 검사·에코 억제용 (→ file-lifecycle.md)
  // CM6 EditorState는 스토어 밖(에디터 인스턴스)에서 관리한다.
}

interface TreeNode {
  path: string;
  name: string;
  kind: 'dir' | 'file';
  isSymlink?: boolean;       // 심볼릭 링크 — 사이드바에서 배지로 표시
  children?: TreeNode[];     // dir일 때만. 부재 = 아직 안 읽음(lazy), [] = 빈 폴더
}

interface WorkspaceState {
  rootDir: string | null;    // 사이드바에 표시할 루트 폴더
  fileTree: TreeNode[];      // Rust read_dir_tree 결과
  tabs: Tab[];
  activeTabId: string | null;
  recentFiles: string[];
}
```

상태는 Zustand 스토어(`apps/desktop`)가 소유한다. **CM6의 `EditorState`는 스토어에 넣지 않는다** — 큰 불변 객체라 스토어에 두면 비용이 크다. 탭별 에디터 인스턴스가 자체 보유하고, 스토어는 메타데이터(dirty·경로·제목)만 추적한다.

## 파일 트리 (사이드바)

- 루트 폴더를 열면 Rust `read_dir_tree`가 재귀적으로 트리를 만들어 반환한다(→ [Rust 커맨드 계약](rust-commands.md)).
- 트리에는 **디렉터리 전부와 `.md`/`.markdown` 파일만** 표시한다. 필터·정렬·숨김·심볼릭 링크의 결정론적 규칙은 [Rust 커맨드 계약](rust-commands.md)의 `read_dir_tree` 반환 규칙을 단일 출처로 둔다.
- 중첩 폴더 = 중첩 페이지. 접기/펼치기.
- 파일 클릭 → 탭으로 연다.
- **전체 인덱싱이 아니라 단순 트리 표시**다 — 파일 내용을 읽어 색인하지 않는다. 이 선이 [비목표](../rules/non-goals.md)의 PKM/vault 인덱싱과 norii를 가른다.
- 단, 항목 수가 매우 많은 트리는 한 번에 전부 재귀로 읽으면 초기 비용이 크다 → **레벨별 lazy 로딩**(폴더를 펼칠 때 그 하위만 읽기)으로 막는다. `read_dir_tree`는 깊이 제한 인자를 받는다.
- 외부에서 파일이 생성/삭제됐을 때 트리를 어떻게 갱신할지(폴더 감시·포커스 시 재읽기·수동 새로고침)는 열린 결정이다(→ [실제 구현 계획](implementation-plan.md#열린-결정-open-decisions)). 열린 파일의 watch와 별개 문제다.

## 다중 탭 규칙

```text
새 문서:   filePath=null, title="Untitled", 첫 저장 시 다이얼로그로 경로 확정
파일 열기: 이미 열린 파일이면 해당 탭 활성화(중복 탭 금지), 아니면 새 탭
탭 닫기:   정규화 승인 불필요/승인된 경로 탭은 플러시 후 닫기, Untitled·미승인·저장 실패는 다이얼로그 (→ file-lifecycle.md 종료 방어와 동일 규칙)
활성 탭:   activeTabId. 에디터/프리뷰는 활성 탭 문서를 표시
```

## 세션 복원

마지막에 열려 있던 탭 목록·활성 탭·루트 폴더는 `plugin-store`(JSON)에, 창 크기·위치는 `plugin-window-state`에 저장하고 재시작 시 복원한다(버전 → [기술 스택](tech-stack.md#tauri-플러그인-네이티브-기능)). 커서 위치까지 복원할지는 열린 결정이다(→ [실제 구현 계획](implementation-plan.md)). 이 상태는 `.md`가 아니라 앱 config에 저장한다(→ [파일 생명주기 정책](file-lifecycle.md)).
