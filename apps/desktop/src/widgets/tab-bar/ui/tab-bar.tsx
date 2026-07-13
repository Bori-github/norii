import { useEffect, useRef } from "react";
import { css } from "styled-system/css";

import { useDocumentStore } from "@entities/document";
import { requestCloseTab, useConflictStore, useMissingFileStore } from "@features/save-file";
import { STRINGS } from "@shared/config";

// 탭바는 유리(크롬)다 — macOS에서 뒤의 바탕화면이 흐려져 비친다(→ DESIGN.md 표면 표).
//
// 유리가 켜지면 웹뷰가 창 맨 위까지 올라와 상단이 한 장이 된다(titleBarStyle: Overlay).
// 그 위 28px는 네이티브 드래그 띠가 덮으므로(→ src-tauri/src/titlebar_drag.rs) 탭을 그 아래로
// 내린다 — 침범하면 탭을 눌러도 클릭이 띠에 먹혀 창이 끌린다.
const barClass = css({
  display: "flex",
  alignItems: "stretch",
  overflowX: "auto",
  background: "bg.chrome",
  borderBottom: "1px solid",
  borderColor: "border",
  minHeight: "9",
  // 띠 높이(28px)와 같아야 한다 — titlebar_drag.rs의 TITLEBAR_STRIP_HEIGHT가 단일 출처다.
  _glass: { position: "relative", paddingTop: "28px" },
});

// 앱 이름 — **우리가 그린다.** OS 타이틀 텍스트를 켜 두면 그 글자가 놓인 자리는 OS 뷰의 것이라
// 드래그 띠보다 위에 있고, 이름 위를 잡으면 창이 끌리지 않는다(실측). 그래서 OS 이름을 끄고
// (hiddenTitle) 같은 자리에 우리가 그린다 — 띠는 투명하므로 이 글자가 그대로 비쳐 보이고,
// 클릭은 띠가 받아 창이 끌린다(→ design/window-chrome.md#계약--드래그-띠).
const appNameClass = css({
  display: "none",
  _glass: {
    display: "flex",
    position: "absolute",
    insetInline: 0,
    top: 0,
    height: "28px",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "sm",
    fontWeight: "medium",
    color: "text",
    // 글자는 보이기만 한다 — 마우스는 위에 얹힌 네이티브 띠가 받는다.
    pointerEvents: "none",
    userSelect: "none",
  },
});

// 유리 위 글자는 흐리게 쓰지 않는다 — 흐린 글자를 읽히게 하려면 유리가 사실상 불투명해져야 한다.
// 활성/비활성은 글자 밝기가 아니라 배경으로 가른다: 활성 탭만 종이를 깐다(→ decisions/0004).
const tabClass = css({
  display: "flex",
  alignItems: "center",
  gap: "1.5",
  paddingX: "3",
  fontSize: "sm",
  color: "text",
  cursor: "pointer",
  borderRight: "1px solid",
  borderColor: "border",
  whiteSpace: "nowrap",
  userSelect: "none",
  _focusVisible: { outline: "2px solid", outlineColor: "accent", outlineOffset: "-2px" },
  _hover: { background: "bg.hover" },
  '&[aria-selected="true"]': {
    background: "bg.paper",
    // 액센트는 종이 위에서만 빛난다 — 활성 탭이 종이이므로 여기서만 dirty ●가 액센트가 된다.
    "& [data-dirty]": { color: "accent" },
  },
});

// 비활성 탭의 ●는 유리 위에 있으므로 본문색이다.
const dirtyClass = css({ color: "text", fontSize: "xs" });

const warningClass = css({ fontSize: "xs" });

const closeClass = css({
  border: "none",
  background: "transparent",
  cursor: "pointer",
  color: "text",
  borderRadius: "sm",
  paddingX: "1",
  _hover: { background: "bg.hover" },
});

// 탭바 — 열린 문서 목록·dirty 표시(●)·닫기. 닫기 규칙(플러시·확인)은 features/save-file이 소유.
// 키보드: roving tabindex(활성 탭만 Tab 정지점) + ←/→ 이동 + Enter/Space 활성화 —
// ARIA tablist 패턴. 포인터 없이도 모든 탭에 도달할 수 있어야 한다.
export function TabBar() {
  const tabs = useDocumentStore((state) => state.tabs);
  const activeTabId = useDocumentStore((state) => state.activeTabId);
  const activateTab = useDocumentStore((state) => state.activateTab);
  const cycleActiveTab = useDocumentStore((state) => state.cycleActiveTab);
  // 충돌·삭제 배너는 활성 탭 전용 — 비활성 탭의 그 상태는 ⚠ 배지가 유일한 신호다
  // (→ file-lifecycle.md#외부-변경-처리 비활성 탭의 충돌 표시).
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

  // 문서가 없어도 탭바는 자리를 지킨다 — "새 탭" 하나가 서고, 그 내용이 빈 상태 안내다
  // (→ document-model.md#빈-탭--탭바는-비지-않는다). 스토어에 빈 문서를 만들지는 않는다.
  if (tabs.length === 0) {
    return (
      <div
        className={barClass}
        role="tablist"
        aria-label={STRINGS.tabListLabel}
        data-testid="tab-bar"
      >
        <span className={appNameClass} aria-hidden="true" data-testid="app-name">
          {STRINGS.appName}
        </span>
        <div role="tab" aria-selected className={tabClass} data-testid="new-tab">
          <span>{STRINGS.newTabTitle}</span>
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
      <span className={appNameClass} aria-hidden="true" data-testid="app-name">
        {STRINGS.appName}
      </span>
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
          {(conflictTabIds.includes(tab.id) || missingTabIds.includes(tab.id)) && (
            <span
              className={warningClass}
              data-testid="tab-warning"
              aria-label={
                conflictTabIds.includes(tab.id)
                  ? STRINGS.conflictBadgeLabel
                  : STRINGS.missingBadgeLabel
              }
            >
              ⚠
            </span>
          )}
          {tab.isDirty && (
            <span className={dirtyClass} data-dirty aria-label={STRINGS.dirtyIndicatorLabel}>
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
