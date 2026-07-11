import { useEffect, useRef } from "react";
import { css } from "styled-system/css";
import { useShallow } from "zustand/react/shallow";

import { useDocumentStore } from "@entities/document";
import { noteDocumentChanged } from "@features/save-file";
import { STRINGS } from "@shared/config";

import { createEditorController, type EditorController } from "../model/editor-controller";

const hostClass = css({
  flex: 1,
  minHeight: 0,
  overflow: "auto",
  "& .cm-editor": { height: "100%" },
});

const emptyClass = css({
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "2",
  color: "text.muted",
});

// 에디터 패널 — 활성 탭의 CM6 뷰를 표시한다. 탭 전환 시 상태를 갈아끼우고,
// docChanged를 dirty 추적·자동 저장 예약으로 연결한다(→ file-lifecycle.md).
export function EditorPane() {
  const activeTabId = useDocumentStore((state) => state.activeTabId);
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
      },
    });
    controllerRef.current.showTab(activeTabId);
  }, [activeTabId]);

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
