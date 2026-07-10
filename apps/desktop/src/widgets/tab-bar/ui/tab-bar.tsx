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
export function TabBar() {
  const tabs = useDocumentStore((state) => state.tabs);
  const activeTabId = useDocumentStore((state) => state.activeTabId);
  const activateTab = useDocumentStore((state) => state.activateTab);

  if (tabs.length === 0) {
    return null;
  }
  return (
    <div className={barClass} role="tablist" data-testid="tab-bar">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tab"
          aria-selected={tab.id === activeTabId}
          className={tabClass}
          data-testid="tab"
          onClick={() => activateTab(tab.id)}
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
