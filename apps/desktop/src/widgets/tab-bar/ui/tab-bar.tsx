import { useEffect, useRef } from "react";
import { css } from "styled-system/css";

import { useDocumentStore } from "@entities/document";
import { requestCloseTab } from "@features/save-file";
import { STRINGS } from "@shared/config";

const barClass = css({
  display: "flex",
  alignItems: "stretch",
  overflowX: "auto",
  background: "bg.canvas",
  borderBottom: "1px solid",
  borderColor: "border",
  minHeight: "9",
});

const tabClass = css({
  display: "flex",
  alignItems: "center",
  gap: "1.5",
  paddingX: "3",
  fontSize: "sm",
  color: "text.muted",
  cursor: "pointer",
  borderRight: "1px solid",
  borderColor: "border",
  whiteSpace: "nowrap",
  userSelect: "none",
  _focusVisible: { outline: "2px solid", outlineColor: "accent", outlineOffset: "-2px" },
  '&[aria-selected="true"]': {
    background: "bg.surface",
    color: "text",
  },
});

const dirtyClass = css({ color: "accent", fontSize: "xs" });

const closeClass = css({
  border: "none",
  background: "transparent",
  cursor: "pointer",
  color: "text.muted",
  borderRadius: "sm",
  paddingX: "1",
  _hover: { color: "text", background: "bg.canvas" },
});

// 탭바 — 열린 문서 목록·dirty 표시(●)·닫기. 닫기 규칙(플러시·확인)은 features/save-file이 소유.
// 키보드: roving tabindex(활성 탭만 Tab 정지점) + ←/→ 이동 + Enter/Space 활성화 —
// ARIA tablist 패턴. 포인터 없이도 모든 탭에 도달할 수 있어야 한다.
export function TabBar() {
  const tabs = useDocumentStore((state) => state.tabs);
  const activeTabId = useDocumentStore((state) => state.activeTabId);
  const activateTab = useDocumentStore((state) => state.activateTab);
  const cycleActiveTab = useDocumentStore((state) => state.cycleActiveTab);
  const barRef = useRef<HTMLDivElement>(null);
  const focusPendingRef = useRef(false);

  // 화살표 키로 활성 탭이 바뀌면 포커스도 새 활성 탭으로 따라간다(roving tabindex).
  useEffect(() => {
    if (!focusPendingRef.current) {
      return;
    }
    focusPendingRef.current = false;
    barRef.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus();
  }, [activeTabId]);

  if (tabs.length === 0) {
    return null;
  }

  function onTabKeyDown(event: React.KeyboardEvent, tabId: string) {
    switch (event.key) {
      case "Enter":
      case " ":
        event.preventDefault();
        activateTab(tabId);
        return;
      case "ArrowRight":
      case "ArrowLeft":
        event.preventDefault();
        focusPendingRef.current = true;
        cycleActiveTab(event.key === "ArrowRight" ? 1 : -1);
        return;
      case "Delete":
      case "Backspace":
        // 닫기 버튼은 탭 정지점이 아니므로(패턴 규칙) 키보드 닫기는 Delete가 담당한다(⌘W도 가능).
        event.preventDefault();
        void requestCloseTab(tabId);
        return;
      default:
    }
  }

  return (
    <div
      ref={barRef}
      className={barClass}
      role="tablist"
      aria-label={STRINGS.tabListLabel}
      data-testid="tab-bar"
    >
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tab"
          aria-selected={tab.id === activeTabId}
          tabIndex={tab.id === activeTabId ? 0 : -1}
          className={tabClass}
          data-testid="tab"
          onClick={() => activateTab(tab.id)}
          onKeyDown={(event) => onTabKeyDown(event, tab.id)}
        >
          <span>{tab.title}</span>
          {tab.isDirty && (
            <span className={dirtyClass} aria-label={STRINGS.dirtyIndicatorLabel}>
              ●
            </span>
          )}
          <button
            type="button"
            className={closeClass}
            aria-label={STRINGS.closeTabLabel}
            tabIndex={-1}
            onClick={(event) => {
              event.stopPropagation();
              void requestCloseTab(tab.id);
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
