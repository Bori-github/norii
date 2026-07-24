import { beforeEach, describe, expect, it } from "vitest";

import type { FileContent } from "@shared/ipc";

import { useDocumentStore } from "./document-store";
import { getInitialText, resetTabTextRegistry } from "./text-access";
import { needsNormalizationApproval } from "./types";

function fileContent(overrides: Partial<FileContent> = {}): FileContent {
  return {
    path: "/vault/doc.md",
    text: "# 본문\n",
    encoding: "utf-8",
    hasBom: false,
    eol: "lf",
    eolMixed: false,
    mtime: 1_000,
    hash: "hash-1",
    ...overrides,
  };
}

beforeEach(() => {
  useDocumentStore.setState({ tabs: [], activeTabId: null });
  resetTabTextRegistry(); // 모듈 전역 본문 레지스트리도 함께 초기화 — 테스트 간 누적 방지.
});

// 집행: document-model.md#다중-탭-규칙 — "새 문서: filePath=null, title=Untitled".
// 왜: Untitled 판별(filePath===null)은 자동 저장 제외·종료 방어 다이얼로그의 분기 기준이다.
// 보장: 새 탭이 규칙대로 생성되고 활성화되며, 새 문서 EOL은 LF다(→ file-lifecycle.md#eol-정책).
// 경계: 첫 저장의 경로 확정 흐름은 save 기능 테스트·E2E가 다룬다.
describe("addUntitledTab", () => {
  it("filePath=null·title=Untitled·LF로 생성하고 활성화한다", () => {
    const id = useDocumentStore.getState().addUntitledTab();
    const { tabs, activeTabId } = useDocumentStore.getState();
    expect(tabs).toHaveLength(1);
    expect(activeTabId).toBe(id);
    expect(tabs[0]).toMatchObject({
      filePath: null,
      title: "Untitled",
      isDirty: false,
      eol: "lf",
      lastSavedHash: null,
    });
  });
});

// 집행: document-model.md#다중-탭-규칙 — "이미 열린 파일이면 해당 탭 활성화(중복 탭 금지)".
// 왜: 같은 파일이 두 탭으로 열리면 한쪽 저장이 다른 쪽을 충돌로 오판한다(자기 충돌).
// 보장: 같은 경로의 재열기는 새 탭 없이 기존 탭을 활성화하고,
//       열기 결과(FileContent)의 메타가 탭에 반영된다.
// 경계: 실제 파일 읽기는 Rust 테스트·E2E 소관 — 여기는 상태 전이만.
describe("openFileTab", () => {
  it("FileContent 메타를 탭에 반영하고 초기 본문을 보관한다", () => {
    const id = useDocumentStore
      .getState()
      .openFileTab(fileContent({ path: "/vault/doc.md", eol: "crlf", hasBom: true }));
    expect(useDocumentStore.getState().tabs[0]).toMatchObject({
      filePath: "/vault/doc.md",
      title: "doc.md",
      sourceEncoding: "utf-8",
      hasBom: true,
      eol: "crlf",
      eolMixed: false,
      lastSavedHash: "hash-1",
    });
    expect(getInitialText(id)).toBe("# 본문\n");
  });

  it("이미 열린 경로는 기존 탭을 활성화하고 새 탭을 만들지 않는다", () => {
    const store = useDocumentStore.getState();
    const first = store.openFileTab(fileContent({ path: "/vault/doc.md" }));
    store.addUntitledTab();
    const again = useDocumentStore.getState().openFileTab(fileContent({ path: "/vault/doc.md" }));
    expect(again).toBe(first);
    expect(useDocumentStore.getState().tabs).toHaveLength(2);
    expect(useDocumentStore.getState().activeTabId).toBe(first);
  });
});

// 집행: document-model.md#다중-탭-규칙 — 활성 탭 추적(activeTabId)과 탭 닫기.
// 왜: 활성 탭이 닫힐 때 다음 표시 대상이 결정론적이지 않으면 에디터가 빈 화면·잘못된
//     문서를 보여준다.
// 보장: 활성 탭을 닫으면 이웃이 활성화되고, 마지막 탭을 닫으면 activeTabId=null이다.
// 경계: 닫기 전 저장 확인(플러시·다이얼로그)은 feature 소관 — 스토어는 제거만 한다.
describe("removeTab", () => {
  it("활성 탭을 닫으면 이웃을 활성화하고, 마지막 탭이면 null이 된다", () => {
    const store = useDocumentStore.getState();
    const a = store.openFileTab(fileContent({ path: "/vault/a.md" }));
    const b = useDocumentStore.getState().openFileTab(fileContent({ path: "/vault/b.md" }));
    const c = useDocumentStore.getState().openFileTab(fileContent({ path: "/vault/c.md" }));

    useDocumentStore.getState().activateTab(b);
    useDocumentStore.getState().removeTab(b);
    expect(useDocumentStore.getState().activeTabId).toBe(c);

    useDocumentStore.getState().removeTab(c);
    expect(useDocumentStore.getState().activeTabId).toBe(a);

    useDocumentStore.getState().removeTab(a);
    expect(useDocumentStore.getState().activeTabId).toBeNull();
    expect(useDocumentStore.getState().tabs).toHaveLength(0);
  });

  it("비활성 탭을 닫아도 활성 탭은 바뀌지 않는다", () => {
    const store = useDocumentStore.getState();
    const a = store.openFileTab(fileContent({ path: "/vault/a.md" }));
    const b = useDocumentStore.getState().openFileTab(fileContent({ path: "/vault/b.md" }));
    useDocumentStore.getState().activateTab(b);
    useDocumentStore.getState().removeTab(a);
    expect(useDocumentStore.getState().activeTabId).toBe(b);
  });
});

// 집행: editor-strategy.md#단축키-계약 — 다음/이전 탭(Ctrl+Tab / Ctrl+Shift+Tab)의 순환 모델.
// 왜: 순환이 경계(첫/마지막 탭)에서 멈추면 단축키만으로 모든 탭에 도달할 수 없다.
// 보장: 양방향 순환이 끝에서 반대쪽 끝으로 감싼다.
// 경계: 키 이벤트 바인딩 자체는 app 레이어·E2E가 다룬다.
describe("cycleActiveTab", () => {
  it("끝에서 반대쪽 끝으로 감싸며 순환한다", () => {
    const store = useDocumentStore.getState();
    const a = store.openFileTab(fileContent({ path: "/vault/a.md" }));
    const b = useDocumentStore.getState().openFileTab(fileContent({ path: "/vault/b.md" }));
    useDocumentStore.getState().activateTab(b);

    useDocumentStore.getState().cycleActiveTab(1);
    expect(useDocumentStore.getState().activeTabId).toBe(a);
    useDocumentStore.getState().cycleActiveTab(-1);
    expect(useDocumentStore.getState().activeTabId).toBe(b);
  });
});

// 집행: document-model.md#상태-구조 + file-lifecycle.md#외부-변경-처리(리로드).
// 왜: 충돌 해소의 "디스크 버전으로 되돌리기"는 본문뿐 아니라 파일 메타(EOL·BOM·해시)도
//     디스크 기준으로 되돌려야 다음 저장이 올바른 형식으로 나간다.
// 보장: updateFileMeta가 파일 유래 메타만 갱신하고 dirty를 해제한다(리로드 = 디스크와 동일).
// 경계: 실제 디스크 리로드(IPC)는 feature·E2E 소관 — 상태 반영만 다룬다.
describe("updateFileMeta", () => {
  it("파일 유래 메타를 갱신하고 dirty를 해제한다", () => {
    const store = useDocumentStore.getState();
    const id = store.openFileTab(fileContent({ path: "/vault/doc.md" }));
    useDocumentStore.getState().setDirty(id, true);

    useDocumentStore
      .getState()
      .updateFileMeta(id, fileContent({ eol: "crlf", hasBom: true, hash: "hash-9" }));

    expect(useDocumentStore.getState().tabs[0]).toMatchObject({
      eol: "crlf",
      hasBom: true,
      lastSavedHash: "hash-9",
      isDirty: false,
    });
  });
});

// 집행: file-lifecycle.md#자동-저장(정규화 승인) + document-model.md#상태-구조.
// 왜: 승인 판정이 틀리면 자동 저장이 사용자가 입력하지 않은 바이트 변경(인코딩 변환·개행
//     통일)을 무단으로 디스크에 쓴다 — 파일 강건성의 안전 핵심이다.
// 보장: 승인 필요 판정(비UTF-8·혼합 EOL), 승인 전이(approveNormalization), 승인 후 첫 저장
//       성공의 메타 갱신(markNormalized — 변환은 1회로 끝난다), 리로드 시 승인 원점 복귀.
// 경계: 승인이 자동 저장을 실제로 여닫는 흐름은 save 기능 테스트가, 배너 UI는 위젯이 다룬다.
describe("정규화 승인", () => {
  it("비UTF-8 또는 혼합 EOL 탭만 승인이 필요하다", () => {
    const store = useDocumentStore.getState();
    const plain = store.openFileTab(fileContent({ path: "/vault/plain.md" }));
    const legacy = useDocumentStore
      .getState()
      .openFileTab(fileContent({ path: "/vault/legacy.md", encoding: "euc-kr" }));
    const mixed = useDocumentStore
      .getState()
      .openFileTab(fileContent({ path: "/vault/mixed.md", eolMixed: true }));

    const tabs = useDocumentStore.getState().tabs;
    expect(needsNormalizationApproval(tabs.find((tab) => tab.id === plain)!)).toBe(false);
    expect(needsNormalizationApproval(tabs.find((tab) => tab.id === legacy)!)).toBe(true);
    expect(needsNormalizationApproval(tabs.find((tab) => tab.id === mixed)!)).toBe(true);
  });

  it("approveNormalization 후에는 승인이 더 필요하지 않다", () => {
    const id = useDocumentStore
      .getState()
      .openFileTab(fileContent({ path: "/vault/legacy.md", encoding: "euc-kr" }));
    useDocumentStore.getState().approveNormalization(id);
    const tab = useDocumentStore.getState().tabs[0]!;
    expect(tab.normalizationApproved).toBe(true);
    expect(needsNormalizationApproval(tab)).toBe(false);
  });

  it("markNormalized는 인코딩·혼합 EOL 메타를 정규화 완료 상태로 만든다", () => {
    const id = useDocumentStore
      .getState()
      .openFileTab(fileContent({ path: "/vault/legacy.md", encoding: "euc-kr", eolMixed: true }));
    useDocumentStore.getState().markNormalized(id);
    expect(useDocumentStore.getState().tabs[0]).toMatchObject({
      sourceEncoding: "utf-8",
      eolMixed: false,
    });
  });

  it("updateFileMeta(디스크 리로드)는 승인을 원점으로 되돌린다", () => {
    const id = useDocumentStore
      .getState()
      .openFileTab(fileContent({ path: "/vault/legacy.md", encoding: "euc-kr" }));
    useDocumentStore.getState().approveNormalization(id);

    // 디스크를 다시 읽었다 — 파일은 여전히 EUC-KR이므로 승인도 다시 받아야 한다.
    useDocumentStore.getState().updateFileMeta(id, fileContent({ encoding: "euc-kr" }));

    const tab = useDocumentStore.getState().tabs[0]!;
    expect(tab.normalizationApproved).toBe(false);
    expect(needsNormalizationApproval(tab)).toBe(true);
  });
});

// 집행: document-model.md#상태-구조 — isDirty·lastSavedHash·경로 확정(Untitled 첫 저장).
// 왜: dirty 표시(●)·충돌 검사 기준값·타이틀이 이 전이에 달려 있다.
// 보장: 개별 전이가 대상 탭에만 적용되고 title이 파일명으로 갱신된다.
// 경계: dirty 해제 시점의 "저장 중 편집" 경합 판단은 save 기능이 결정한다.
describe("탭 메타 전이", () => {
  it("setDirty·setLastSavedHash·assignPath가 대상 탭만 갱신한다", () => {
    const store = useDocumentStore.getState();
    const a = store.addUntitledTab();
    useDocumentStore.getState().addUntitledTab();

    useDocumentStore.getState().setDirty(a, true);
    useDocumentStore.getState().setLastSavedHash(a, "hash-2");
    useDocumentStore.getState().assignPath(a, "/vault/새 문서.md");

    const [tabA, tabB] = useDocumentStore.getState().tabs;
    expect(tabA).toMatchObject({
      isDirty: true,
      lastSavedHash: "hash-2",
      filePath: "/vault/새 문서.md",
      title: "새 문서.md",
    });
    expect(tabB).toMatchObject({ isDirty: false, filePath: null, lastSavedHash: null });
  });
});

// 집행: document-model.md#파일-트리-사이드바 — "클릭은 포커스를 트리에 남긴다".
// 왜: 사이드바 트리 클릭이 파일을 열되 포커스를 뺏기지 않아야 방향키 탐색이 이어진다.
//     이 의도는 focusEditorOnActivate로 전달되고, editor-pane이 그 값으로 view.focus를 가른다.
// 보장: 기본 활성화는 에디터 포커스(true)이고, focusEditor=false 열기만 false다. 다음 활성화가
//       값을 새로 정해 false가 남지 않는다.
// 경계: 실제로 에디터가 포커스를 안 가져가는지는 editor-pane 배선의 몫이다(실앱·수동 확인).
describe("focusEditorOnActivate", () => {
  it("기본 열기·활성화는 에디터 포커스(true)다", () => {
    const store = useDocumentStore.getState();
    store.openFileTab(fileContent());
    expect(useDocumentStore.getState().focusEditorOnActivate).toBe(true);
  });

  it("focusEditor=false 열기는 포커스를 넘기지 않는다(false)", () => {
    useDocumentStore.getState().openFileTab(fileContent(), false);
    expect(useDocumentStore.getState().focusEditorOnActivate).toBe(false);
  });

  it("false 뒤의 다음 활성화가 true로 되돌린다 — false가 남지 않는다", () => {
    useDocumentStore.getState().openFileTab(fileContent({ path: "/vault/a.md" }), false);
    expect(useDocumentStore.getState().focusEditorOnActivate).toBe(false);
    useDocumentStore.getState().addUntitledTab();
    expect(useDocumentStore.getState().focusEditorOnActivate).toBe(true);
  });
});
