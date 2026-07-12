import { createEditorState, createEditorView, lineScrollTop, topVisibleLine } from "@norii/editor";

import { getInitialText, registerTabTextHandle, unregisterTabTextHandle } from "@entities/document";
import { createEchoGuard, type ScrollPosition } from "@features/scroll-sync";
import { EDITOR_COLORS } from "@shared/config";

// 탭별 편집 상태 관리 — CM6 EditorState는 스토어 밖에서 관리한다(→ document-model.md#상태-구조).
// 뷰(EditorView)는 하나만 두고 탭 전환 시 상태를 갈아끼운다 — 탭 수만큼 DOM을 만들지 않는다.

type EditorStateValue = ReturnType<typeof createEditorState>;
type EditorViewValue = ReturnType<typeof createEditorView>;

export interface EditorController {
  /** 탭을 화면에 표시한다. 이전 탭의 편집 상태는 보존된다. */
  showTab(tabId: string): void;
  /** 열린 탭 목록과 동기화 — 닫힌 탭의 상태·핸들을 정리한다. */
  syncTabs(openTabIds: string[]): void;
  /** 동기화 신호를 받아 뷰포트를 옮긴다 — 이때 생기는 scroll 이벤트는 에코로 걸러진다. */
  applyScrollSync(position: ScrollPosition): void;
  destroy(): void;
}

interface Options {
  parent: HTMLElement;
  /** 문서 내용이 실제로 바뀔 때(docChanged) — dirty 추적·자동 저장 예약의 신호. */
  onDocChanged: (tabId: string) => void;
  /** 사용자 스크롤 시 뷰포트 상단의 소스 위치 — 동기화 발행용(에코는 걸러져 있음). */
  onScroll?: (position: ScrollPosition) => void;
}

export function createEditorController(options: Options): EditorController {
  const states = new Map<string, EditorStateValue>();
  let view: EditorViewValue | null = null;
  let activeTabId: string | null = null;
  // 동기화가 만든 프로그램적 스크롤의 에코를 걸러낸다(→ features/scroll-sync).
  const echoGuard = createEchoGuard();

  function attachScrollListener(target: EditorViewValue): void {
    target.scrollDOM.addEventListener("scroll", () => {
      if (echoGuard.shouldIgnore() || !view) {
        return;
      }
      options.onScroll?.(topVisibleLine(view));
    });
  }

  function currentText(tabId: string): string | null {
    if (tabId === activeTabId && view) {
      return view.state.doc.toString();
    }
    const state = states.get(tabId);
    return state ? state.doc.toString() : null;
  }

  function makeState(tabId: string, doc: string): EditorStateValue {
    return createEditorState({
      colors: EDITOR_COLORS,
      doc,
      onDocChanged: () => options.onDocChanged(tabId),
    });
  }

  // 본문 전체 교체 — 충돌 해소의 "디스크 버전으로 되돌리기". undo 히스토리는 리셋된다.
  function setDocText(tabId: string, text: string): void {
    const fresh = makeState(tabId, text);
    states.set(tabId, fresh);
    if (tabId === activeTabId && view) {
      view.setState(fresh);
    }
  }

  function ensureState(tabId: string): EditorStateValue {
    let state = states.get(tabId);
    if (!state) {
      state = makeState(tabId, getInitialText(tabId));
      states.set(tabId, state);
      // features(저장·충돌 해소)가 스토어 밖 본문에 접근하는 통로(→ entities/document).
      registerTabTextHandle(tabId, {
        getText: () => currentText(tabId) ?? "",
        setText: (text) => setDocText(tabId, text),
      });
    }
    return state;
  }

  return {
    showTab(tabId) {
      if (tabId === activeTabId && view) {
        return;
      }
      if (view && activeTabId !== null && states.has(activeTabId)) {
        // 떠나는 탭의 편집 상태(문서·커서·undo)를 보존한다.
        states.set(activeTabId, view.state);
      }
      const next = ensureState(tabId);
      if (!view) {
        view = createEditorView({ parent: options.parent, colors: EDITOR_COLORS });
        attachScrollListener(view);
      }
      view.setState(next);
      activeTabId = tabId;
      view.focus();
    },
    syncTabs(openTabIds) {
      const open = new Set(openTabIds);
      const closed = Array.from(states.keys()).filter((tabId) => !open.has(tabId));
      for (const tabId of closed) {
        states.delete(tabId);
        unregisterTabTextHandle(tabId);
        if (tabId === activeTabId) {
          activeTabId = null;
        }
      }
    },
    applyScrollSync(position) {
      if (!view) {
        return;
      }
      const target = lineScrollTop(view, position.line, position.fraction);
      // 이미 그 자리면 적용하지 않는다 — scroll 이벤트가 안 생겨 가드 짝이 어긋나는 것을 방지.
      if (Math.abs(view.scrollDOM.scrollTop - target) < 1) {
        return;
      }
      echoGuard.arm();
      view.scrollDOM.scrollTop = target;
    },
    destroy() {
      for (const tabId of states.keys()) {
        unregisterTabTextHandle(tabId);
      }
      states.clear();
      view?.destroy();
      view = null;
      activeTabId = null;
    },
  };
}
