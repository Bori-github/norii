import { useEffect } from "react";

import { useDocumentStore } from "@entities/document";
import { openFileInteractive } from "@features/open-file";
import { requestCloseTab, saveTabAs, saveTabNow } from "@features/save-file";
import { isPrimaryModifier } from "@shared/lib";

// 앱 전역 단축키 — 표의 단일 출처: editor-strategy.md#단축키-계약.
// CM6 내부 키맵(검색·히스토리)은 에디터가 처리하고, 여기는 앱 전역 동작만 다룬다.
// capture 단계에서 받아 CM6·브라우저 기본 동작보다 먼저 가로챈다.
export function useGlobalShortcuts(): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // 다음/이전 탭 — Ctrl+Tab / Ctrl+Shift+Tab (모든 플랫폼 공통).
      if (event.ctrlKey && event.key === "Tab") {
        event.preventDefault();
        useDocumentStore.getState().cycleActiveTab(event.shiftKey ? -1 : 1);
        return;
      }
      if (!isPrimaryModifier(event) || event.altKey) {
        return;
      }
      const activeTabId = useDocumentStore.getState().activeTabId;
      switch (event.key.toLowerCase()) {
        case "s":
          // Cmd+S 즉시 저장(디바운스 대기 없음) · Cmd+Shift+S 다른 이름으로 저장.
          event.preventDefault();
          if (activeTabId !== null) {
            void (event.shiftKey ? saveTabAs(activeTabId) : saveTabNow(activeTabId));
          }
          return;
        case "n":
          event.preventDefault();
          useDocumentStore.getState().addUntitledTab();
          return;
        case "o":
          event.preventDefault();
          void openFileInteractive();
          return;
        case "w":
          event.preventDefault();
          if (activeTabId !== null) {
            void requestCloseTab(activeTabId);
          }
          return;
        default:
      }
    }
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, []);
}
