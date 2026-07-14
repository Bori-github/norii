import { create } from "zustand";

import { STRINGS } from "@shared/config";
import type { FileContent } from "@shared/ipc";

import { clearTabText, setInitialText } from "./text-access";
import type { Tab } from "./types";

// 다중 탭 상태 — 규칙의 단일 출처: .claude/docs/document-model.md#다중-탭-규칙.
// WorkspaceState의 rootDir·fileTree(M5)·recentFiles는 해당 마일스톤에서 추가한다.

interface DocumentState {
  tabs: Tab[];
  activeTabId: string | null;
}

interface DocumentActions {
  /** 파일을 탭으로 연다. 이미 열린 파일이면 그 탭을 활성화한다(중복 탭 금지). */
  openFileTab(path: string, file: FileContent): string;
  /** 새 문서 탭 — filePath=null, title="Untitled". */
  addUntitledTab(): string;
  /** 탭 제거(저장 확인은 호출 측 책임). 활성 탭이 닫히면 이웃을 활성화한다. */
  removeTab(tabId: string): void;
  activateTab(tabId: string): void;
  /** 다음/이전 탭 순환(Ctrl+Tab / Ctrl+Shift+Tab). */
  cycleActiveTab(delta: 1 | -1): void;
  setDirty(tabId: string, isDirty: boolean): void;
  /** 저장 성공 후 해시 갱신 — dirty 해제는 저장 시점 텍스트 비교 후 호출 측이 결정한다. */
  setLastSavedHash(tabId: string, hash: string): void;
  /** Untitled 첫 저장에서 경로 확정 — title도 파일명으로 갱신된다. */
  assignPath(tabId: string, path: string): void;
  /** 디스크 리로드 후 파일 유래 메타 반영 — 리로드 직후는 디스크와 동일하므로 dirty 해제. */
  updateFileMeta(tabId: string, file: FileContent): void;
  /** 정규화 승인 — 배너 승인·첫 수동 저장이 부른다. 승인은 탭 상태다 (→ file-lifecycle.md#자동-저장). */
  approveNormalization(tabId: string): void;
  /** 승인 후 첫 저장 성공 — 디스크가 UTF-8·판정 EOL로 통일됐다. 변환은 1회로 끝난다(배너 해제). */
  markNormalized(tabId: string): void;
}

export type DocumentStore = DocumentState & DocumentActions;

function fileNameOf(path: string): string {
  // Windows canonical 경로(\\?\C:\...)까지 고려해 양쪽 구분자를 다룬다(→ platform-strategy.md).
  const name = path.split(/[/\\]/).at(-1);
  return name && name.length > 0 ? name : path;
}

function updateTab(tabs: Tab[], tabId: string, patch: Partial<Tab>): Tab[] {
  return tabs.map((tab) => (tab.id === tabId ? { ...tab, ...patch } : tab));
}

export const useDocumentStore = create<DocumentStore>()((set, get) => ({
  tabs: [],
  activeTabId: null,

  openFileTab(path, file) {
    const existing = get().tabs.find((tab) => tab.filePath === path);
    if (existing) {
      set({ activeTabId: existing.id });
      return existing.id;
    }
    const id = crypto.randomUUID();
    // 본문은 스토어 밖에 둔다 — 에디터 뷰가 마운트될 때 이 초기 본문을 읽는다.
    setInitialText(id, file.text);
    const tab: Tab = {
      id,
      filePath: path,
      title: fileNameOf(path),
      isDirty: false,
      sourceEncoding: file.encoding,
      hasBom: file.hasBom,
      eol: file.eol,
      eolMixed: file.eolMixed,
      normalizationApproved: false,
      lastSavedHash: file.hash,
    };
    set((state) => ({ tabs: [...state.tabs, tab], activeTabId: id }));
    return id;
  },

  addUntitledTab() {
    const id = crypto.randomUUID();
    setInitialText(id, "");
    const tab: Tab = {
      id,
      filePath: null,
      title: STRINGS.untitledTitle,
      isDirty: false,
      sourceEncoding: "utf-8",
      hasBom: false,
      // 새 문서는 모든 플랫폼에서 LF (→ file-lifecycle.md#eol-정책).
      eol: "lf",
      eolMixed: false,
      normalizationApproved: false,
      lastSavedHash: null,
    };
    set((state) => ({ tabs: [...state.tabs, tab], activeTabId: id }));
    return id;
  },

  removeTab(tabId) {
    clearTabText(tabId);
    set((state) => {
      const index = state.tabs.findIndex((tab) => tab.id === tabId);
      if (index === -1) {
        return state;
      }
      const tabs = state.tabs.filter((tab) => tab.id !== tabId);
      let activeTabId = state.activeTabId;
      if (activeTabId === tabId) {
        // 닫힌 자리의 이웃(같은 인덱스, 마지막이었다면 새 마지막)을 활성화한다.
        const neighbor = tabs[Math.min(index, tabs.length - 1)];
        activeTabId = neighbor ? neighbor.id : null;
      }
      return { tabs, activeTabId };
    });
  },

  activateTab(tabId) {
    if (get().tabs.some((tab) => tab.id === tabId)) {
      set({ activeTabId: tabId });
    }
  },

  cycleActiveTab(delta) {
    const { tabs, activeTabId } = get();
    if (tabs.length < 2 || activeTabId === null) {
      return;
    }
    const index = tabs.findIndex((tab) => tab.id === activeTabId);
    const next = tabs[(index + delta + tabs.length) % tabs.length];
    if (next) {
      set({ activeTabId: next.id });
    }
  },

  setDirty(tabId, isDirty) {
    set((state) => {
      // 이미 같은 값이면 상태를 만들지 않는다 — docChanged는 매 키 입력마다 오므로,
      // 무조건 새 배열을 만들면 타이핑 내내 스토어 구독자(탭바)가 리렌더된다.
      const tab = state.tabs.find((candidate) => candidate.id === tabId);
      if (!tab || tab.isDirty === isDirty) {
        return state;
      }
      return { tabs: updateTab(state.tabs, tabId, { isDirty }) };
    });
  },

  setLastSavedHash(tabId, hash) {
    set((state) => ({ tabs: updateTab(state.tabs, tabId, { lastSavedHash: hash }) }));
  },

  assignPath(tabId, path) {
    set((state) => ({
      tabs: updateTab(state.tabs, tabId, { filePath: path, title: fileNameOf(path) }),
    }));
  },

  updateFileMeta(tabId, file) {
    set((state) => ({
      tabs: updateTab(state.tabs, tabId, {
        sourceEncoding: file.encoding,
        hasBom: file.hasBom,
        eol: file.eol,
        eolMixed: file.eolMixed,
        // 디스크를 다시 읽었다 — 파일이 여전히 정규화 대상이면 승인도 다시 받는다.
        normalizationApproved: false,
        lastSavedHash: file.hash,
        isDirty: false,
      }),
    }));
  },

  approveNormalization(tabId) {
    set((state) => ({ tabs: updateTab(state.tabs, tabId, { normalizationApproved: true }) }));
  },

  markNormalized(tabId) {
    set((state) => ({
      tabs: updateTab(state.tabs, tabId, { sourceEncoding: "utf-8", eolMixed: false }),
    }));
  },
}));

/** 현재 상태에서 탭을 찾는다 — 스토어 밖(feature 로직)에서의 조회 헬퍼. */
export function findTab(tabId: string): Tab | undefined {
  return useDocumentStore.getState().tabs.find((tab) => tab.id === tabId);
}
