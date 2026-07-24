import { useEffect, useRef } from "react";
import { css } from "styled-system/css";
import { useShallow } from "zustand/react/shallow";

import { notifyDocChanged, useDocumentStore } from "@entities/document";
import { noteDocumentChanged } from "@features/save-file";
import { publishScroll, subscribeScroll } from "@features/scroll-sync";
import { STRINGS } from "@shared/config";

import { createEditorController, type EditorController } from "../model/editor-controller";

// 편집면은 종이다 — 불투명 배경을 **명시적으로** 칠한다. 유리가 켜져 있으므로(창이 투명하다)
// 캔버스를 비쳐 쓰면 본문 뒤로 바탕화면이 그대로 지나간다(→ decisions/surface · window-chrome.md).
// "편집면"은 CM6가 글자를 그린 픽셀이 아니라 이 패널이 차지하는 사각형 전체다.
const hostClass = css({
  flex: 1,
  minHeight: 0,
  overflow: "auto",
  background: "bg.paper",
  "& .cm-editor": { height: "100%" },
  // CM6 baseTheme가 .cm-content에 직접 font-family를 걸어 .cm-editor의 값을 덮는다.
  // 토큰이 실제로 적용되려면 같은 요소를 겨냥해야 한다(실앱에서 monospace로 나오는 것을 확인).
  // 리거처를 끄는 이유는 decisions/typography가 소유한다.
  "& .cm-content": {
    fontFamily: "editor",
    fontSize: "sm",
    lineHeight: "editor",
    fontVariantLigatures: "none",
  },
});

// 빈 상태(탭 0개)도 종이다 — 여기가 뚫리면 바탕화면 위에 글자가 뜬다.
const emptyClass = css({
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "2",
  background: "bg.paper",
  color: "text.muted",
});

// 에디터 패널 — 활성 탭의 CM6 뷰를 표시한다. 탭 전환 시 상태를 갈아끼우고,
// docChanged를 dirty 추적·자동 저장 예약으로 연결한다(→ file-lifecycle.md).
export function EditorPane() {
  const activeTabId = useDocumentStore((state) => state.activeTabId);
  // 활성화마다 새로 정해지므로, 같은 탭이 focus=true로 다시 활성화되면(트리 클릭 후 Enter)
  // 이 값이 바뀌어 이펙트가 다시 돌아 view.focus()가 호출된다(→ document-store).
  const focusEditorOnActivate = useDocumentStore((state) => state.focusEditorOnActivate);
  const openTabIds = useDocumentStore(useShallow((state) => state.tabs.map((tab) => tab.id)));
  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<EditorController | null>(null);

  useEffect(() => {
    controllerRef.current?.syncTabs(openTabIds);
  }, [openTabIds]);

  useEffect(() => {
    if (activeTabId === null) {
      // 모든 탭이 닫힘 — 호스트 DOM이 사라지므로 뷰도 정리한다.
      controllerRef.current?.destroy();
      controllerRef.current = null;
      return;
    }
    const host = hostRef.current;
    if (!host) {
      return;
    }
    controllerRef.current ??= createEditorController({
      parent: host,
      onDocChanged: (tabId) => {
        useDocumentStore.getState().setDirty(tabId, true);
        noteDocumentChanged(tabId);
        // 프리뷰 등 파생 뷰의 갱신 신호(→ entities/document의 문서 변경 신호).
        notifyDocChanged(tabId);
      },
      // 스크롤 동기화 — 사용자 스크롤을 중계소로 발행한다(→ features/scroll-sync).
      onScroll: (position) => publishScroll("editor", position),
    });
    controllerRef.current.showTab(activeTabId, focusEditorOnActivate);
  }, [activeTabId, focusEditorOnActivate]);

  // 프리뷰발 동기화 신호를 받아 뷰포트를 따라 옮긴다.
  useEffect(
    () => subscribeScroll("editor", (position) => controllerRef.current?.applyScrollSync(position)),
    [],
  );

  useEffect(
    () => () => {
      controllerRef.current?.destroy();
      controllerRef.current = null;
    },
    [],
  );

  if (activeTabId === null) {
    return (
      <div className={emptyClass} data-testid="empty-state">
        <strong>{STRINGS.emptyStateTitle}</strong>
        <span>{STRINGS.emptyStateHint}</span>
      </div>
    );
  }
  return <div ref={hostRef} className={hostClass} data-testid="editor-pane" />;
}
