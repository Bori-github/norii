import { useEffect, useRef } from "react";
import { css, cx } from "styled-system/css";

import { useDocumentStore } from "@entities/document";
import { requestCloseTab, useConflictStore, useMissingFileStore } from "@features/save-file";
import { STRINGS } from "@shared/config";
import { CloseIcon, IconButton } from "@shared/ui";

import { TabStatusDot } from "./tab-status-dot";

// 탭바는 유리(크롬)다 — 뒤의 바탕화면이 흐려져 비친다(→ DESIGN.md 표면 표). 유리 드래그 띠·앱
// 이름·토글은 타이틀 스트립이 소유한다(→ widgets/title-strip); 탭바는 그 아래 오른쪽 칸에 선다.
// overflowX는 위아래도 잘라낸다 — 세로 여백을 줄이면 활성 탭의 그림자가 잘린다.
const barClass = css({
  display: "flex",
  alignItems: "center",
  gap: "1",
  minWidth: 0,
  overflowX: "auto",
  padding: "1.5",
  background: "bg.chrome",
  borderBottomWidth: "1px",
  borderBottomStyle: "solid",
  borderBottomColor: "border",
});

const tabClass = css({
  display: "flex",
  alignItems: "center",
  gap: "1.5",
  flexShrink: 0,
  width: "48",
  height: "8",
  paddingLeft: "2",
  paddingRight: "1.5",
  fontSize: "sm",
  color: "text",
  cursor: "pointer",
  whiteSpace: "nowrap",
  userSelect: "none",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "transparent",
  borderRadius: "md",
  layerStyle: "focusInside",
  _hover: { background: "bg.hover" },
  '&[aria-selected="true"]': {
    background: "bg.paper",
    borderColor: "border",
    boxShadow: "sm",
    // 명시하지 않으면 specificity가 같은 호버가 나중에 나와 종이를 반투명 틴트로 덮는다.
    _hover: { background: "bg.paper" },
  },
});

const titleClass = css({
  flex: "1 1 auto",
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
});

const alertTitleClass = css({ color: "status.danger" });

// 탭바 — 열린 문서 목록·상태 점·닫기. 닫기 규칙(플러시·확인)은 features/save-file이 소유.
// 키보드: roving tabindex(활성 탭만 Tab 정지점) + ←/→ 이동 + Enter/Space 활성화 —
// ARIA tablist 패턴. 포인터 없이도 모든 탭에 도달할 수 있어야 한다.
export function TabBar() {
  const tabs = useDocumentStore((state) => state.tabs);
  const activeTabId = useDocumentStore((state) => state.activeTabId);
  const activateTab = useDocumentStore((state) => state.activateTab);
  const cycleActiveTab = useDocumentStore((state) => state.cycleActiveTab);
  const conflictTabIds = useConflictStore((state) => state.conflictTabIds);
  const missingTabIds = useMissingFileStore((state) => state.missingTabIds);
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

  // 문서가 없어도 탭바는 자리를 지킨다 — "새 탭" 하나가 남고, 그 내용이 빈 상태 안내다
  // (→ document-model.md#빈-탭--탭바는-비지-않는다). 스토어에 빈 문서를 만들지는 않는다.
  if (tabs.length === 0) {
    return (
      <div
        className={barClass}
        role="tablist"
        aria-label={STRINGS.tabListLabel}
        data-testid="tab-bar"
      >
        <div role="tab" aria-selected className={tabClass} data-testid="new-tab">
          <span className={titleClass}>{STRINGS.newTabTitle}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={barRef}
      className={barClass}
      role="tablist"
      aria-label={STRINGS.tabListLabel}
      data-testid="tab-bar"
    >
      {tabs.map((tab) => {
        const alerted = conflictTabIds.includes(tab.id) || missingTabIds.includes(tab.id);
        return (
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
            {alerted ? (
              <TabStatusDot
                status="alerted"
                label={
                  conflictTabIds.includes(tab.id)
                    ? STRINGS.conflictBadgeLabel
                    : STRINGS.missingBadgeLabel
                }
              />
            ) : (
              tab.isDirty && <TabStatusDot status="pending" label={STRINGS.dirtyIndicatorLabel} />
            )}
            <span className={cx(titleClass, alerted ? alertTitleClass : undefined)}>
              {tab.title}
            </span>
            <IconButton
              size="sm"
              label={STRINGS.closeTabLabel}
              tabIndex={-1}
              onClick={(event) => {
                event.stopPropagation();
                void requestCloseTab(tab.id);
              }}
            >
              <CloseIcon />
            </IconButton>
          </div>
        );
      })}
    </div>
  );
}
