import {
  createEditorState,
  createEditorView,
  cursorPosition,
  lineScrollTop,
  scrollToLine,
  topVisibleLine,
} from "@norii/editor";

import {
  clearTabViewState,
  getInitialText,
  getTabScroll,
  registerTabTextHandle,
  setTabScroll,
  unregisterTabTextHandle,
} from "@entities/document";
import { clearChars, clearEditorStatus, reportChars, reportCursor } from "@features/editor-status";
import {
  applyGuardedScrollTop,
  createEchoGuard,
  isAtBottom,
  type ScrollPosition,
} from "@features/scroll-sync";
import { countChars } from "@shared/lib";
import { EDITOR_COLORS } from "@shared/config";

// 탭별 편집 상태 관리 — CM6 EditorState는 스토어 밖에서 관리한다(→ document-model.md#상태-구조).
// 뷰(EditorView)는 하나만 두고 탭 전환 시 상태를 갈아끼운다 — 탭 수만큼 DOM을 만들지 않는다.

type EditorStateValue = ReturnType<typeof createEditorState>;
type EditorViewValue = ReturnType<typeof createEditorView>;

export interface EditorController {
  /** 탭을 화면에 표시한다. 이전 탭의 편집 상태는 보존된다. focus=false면 view.focus()를
   *  건너뛴다(호출 의도는 → document-store). */
  showTab(tabId: string, focus?: boolean): void;
  /** 열린 탭 목록과 동기화 — 닫힌 탭의 상태·핸들을 정리한다. */
  syncTabs(openTabIds: string[]): void;
  /** 편집면이 다시 보일 때 활성 탭의 기억한 자리를 적용한다(숨은 동안은 보류된다). */
  reapplyScroll(): void;
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

  // 자 수는 문서 전체를 훑으므로 키 입력마다 계산하지 않는다.
  const STATS_DEBOUNCE_MS = 300;
  // 이 길이까지는 탭 전환·본문 교체 때 즉시 센다 — 그보다 크면 전환을 막지 않게
  // 자 수를 비우고 디바운스로 미룬다(커서는 항상 즉시).
  const SYNC_COUNT_MAX_LENGTH = 100_000;
  let statsTimer: ReturnType<typeof setTimeout> | null = null;
  function scheduleStats(): void {
    if (statsTimer !== null) {
      clearTimeout(statsTimer);
    }
    statsTimer = setTimeout(() => {
      statsTimer = null;
      if (view) {
        reportChars(countChars(view.state.doc.toString()));
      }
    }, STATS_DEBOUNCE_MS);
  }

  function reportStatusFor(state: EditorStateValue): void {
    reportCursor(cursorPosition(state));
    if (state.doc.length <= SYNC_COUNT_MAX_LENGTH) {
      reportChars(countChars(state.doc.toString()));
    } else {
      clearChars();
      scheduleStats();
    }
  }

  function attachScrollListener(target: EditorViewValue): void {
    target.scrollDOM.addEventListener("scroll", () => {
      const ignore = echoGuard.shouldIgnore();
      if (!view) {
        return;
      }
      const position = topVisibleLine(view);
      // 자리는 움직일 때마다 기억한다 — 탭을 떠날 때만 기억하면, 편집면이 숨은 뒤
      // (프리뷰 전용 모드) 떠나는 경우 측정이 안 돼 그 사이의 이동이 사라진다.
      if (activeTabId !== null && isLaidOut()) {
        setTabScroll(activeTabId, position);
      }
      if (ignore) {
        return;
      }
      // 바닥에 닿으면 가장자리 스냅을 표시한다 — 반대 패널도 바닥으로 정렬된다.
      options.onScroll?.(isAtBottom(view.scrollDOM) ? { ...position, edge: "bottom" } : position);
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
      onDocChanged: () => {
        options.onDocChanged(tabId);
        scheduleStats();
      },
      onSelectionChanged: reportCursor,
    });
  }

  // 본문 전체 교체 — 충돌 해소의 "디스크 버전으로 되돌리기". undo 히스토리는 리셋된다.
  function setDocText(tabId: string, text: string): void {
    const fresh = makeState(tabId, text);
    states.set(tabId, fresh);
    if (tabId === activeTabId && view) {
      view.setState(fresh);
      // setState는 updateListener를 태우지 않는다 — showTab과 같은 이유로 직접 갱신한다.
      reportStatusFor(fresh);
    }
  }

  // 숨은 편집면(프리뷰 전용 모드)은 높이가 0이라 측정이 맨 위를 가리키고 스크롤 지정도 먹지
  // 않는다. 그래서 숨은 동안에는 기억을 쓰지도 읽지도 않고, 다시 보일 때 reapplyScroll이 잇는다.
  function isLaidOut(): boolean {
    return view !== null && view.scrollDOM.clientHeight > 0;
  }

  function rememberScroll(tabId: string): void {
    if (view && isLaidOut()) {
      setTabScroll(tabId, topVisibleLine(view));
    }
  }

  function applyRememberedScroll(tabId: string): void {
    if (!view || !isLaidOut()) {
      return;
    }
    const scroll = getTabScroll(tabId);
    if (scroll) {
      scrollToLine(view, scroll.line, scroll.fraction);
    } else {
      // 기억이 없으면 맨 위다 — setState는 DOM 스크롤을 건드리지 않아, 두지 않으면 떠난 탭의
      // 픽셀 위치가 새 탭에 그대로 남는다.
      view.scrollDOM.scrollTop = 0;
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
    showTab(tabId, focus = true) {
      if (tabId === activeTabId && view) {
        // 이미 보이는 탭이라도 포커스 요청은 존중한다 — 트리 클릭(focus=false)으로 활성만
        // 시킨 파일을 Enter로 다시 활성화(focus=true)해 편집에 진입하는 경로.
        if (focus) {
          view.focus();
        }
        return;
      }
      if (view && activeTabId !== null && states.has(activeTabId)) {
        // 떠나는 탭의 편집 상태(문서·커서·undo)를 보존한다.
        states.set(activeTabId, view.state);
        // 스크롤 이벤트 없이 상단 라인이 바뀌는 경우(본문 교체·뷰포트 위쪽 편집)를 여기서 잡는다.
        rememberScroll(activeTabId);
      }
      const next = ensureState(tabId);
      if (!view) {
        view = createEditorView({ parent: options.parent, colors: EDITOR_COLORS });
        attachScrollListener(view);
      }
      view.setState(next);
      applyRememberedScroll(tabId);
      activeTabId = tabId;
      if (focus) {
        view.focus();
      }
      // 이전 탭의 값이 남지 않게 즉시 갱신한다 — 디바운스를 기다리면 그동안 틀린 값이 보인다.
      reportStatusFor(next);
    },
    syncTabs(openTabIds) {
      const open = new Set(openTabIds);
      const closed = Array.from(states.keys()).filter((tabId) => !open.has(tabId));
      for (const tabId of closed) {
        states.delete(tabId);
        clearTabViewState(tabId);
        unregisterTabTextHandle(tabId);
        if (tabId === activeTabId) {
          activeTabId = null;
        }
      }
    },
    reapplyScroll() {
      if (activeTabId !== null) {
        applyRememberedScroll(activeTabId);
      }
    },
    applyScrollSync(position) {
      if (!view) {
        return;
      }
      // 클램프·"이미 그 자리" 판정·arm 짝 맞춤은 공용 헬퍼가 보장한다(→ features/scroll-sync).
      // 가장자리 스냅: 상대가 바닥이면 라인 계산 대신 우리 바닥으로(헬퍼가 max로 클램프).
      applyGuardedScrollTop(
        echoGuard,
        view.scrollDOM,
        position.edge === "bottom"
          ? Number.MAX_SAFE_INTEGER
          : lineScrollTop(view, position.line, position.fraction),
      );
    },
    destroy() {
      if (statsTimer !== null) {
        clearTimeout(statsTimer);
        statsTimer = null;
      }
      clearEditorStatus();
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
