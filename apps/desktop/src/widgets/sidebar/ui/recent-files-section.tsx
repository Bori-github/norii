import { useRef, useState } from "react";
import { css } from "styled-system/css";

import { useWorkspaceStore } from "@entities/workspace";
import { openPathInTab } from "@features/open-file";
import { STRINGS } from "@shared/config";
import { entryNameOf } from "@shared/lib";
import { Button, ChevronRightIcon } from "@shared/ui";

import { toggleRecentSection, useRecentSectionStore } from "../model/recent-section-store";

// 최근 파일 영역 — 규칙의 단일 출처: document-model.md#최근-파일.

const sectionClass = css({
  flexShrink: 0,
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  borderTopWidth: "1px",
  borderTopStyle: "solid",
  borderTopColor: "border",
});

const headerClass = css({
  display: "flex",
  alignItems: "center",
  gap: "1",
  width: "100%",
  paddingX: "2",
  height: "8",
  flexShrink: 0,
  border: "none",
  background: "transparent",
  fontSize: "xs",
  color: "text.muted",
  cursor: "pointer",
  layerStyle: "focusInside",
  transitionProperty: "color",
  transitionDuration: "fast",
  transitionTimingFunction: "out",
  _motionReduce: { transition: "none" },
  _hover: { color: "text" },
});

const chevronClass = css({
  flexShrink: 0,
  width: "3.5",
  height: "3.5",
  transitionProperty: "transform",
  transitionDuration: "fast",
  transitionTimingFunction: "out",
  _motionReduce: { transition: "none" },
  '[aria-expanded="true"] > &': { transform: "rotate(90deg)" },
});

// 접기/펼치기 전환 규칙 → decisions/motion.md.
const collapseClass = css({
  display: "grid",
  gridTemplateRows: "1fr",
  minHeight: 0,
  overflow: "hidden",
  transitionProperty: "grid-template-rows, visibility",
  transitionDuration: "fast",
  transitionTimingFunction: "out",
  _motionReduce: { transition: "none" },
  '&[data-collapsed="true"]': { gridTemplateRows: "0fr", visibility: "hidden" },
});

// 안쪽 여백은 포커스 링의 자리다 — overflow가 잘라내는 면이라 여백이 바깥 링보다
// 좁으면 링이 가장자리에서 잘린다(링 크기 → panda.config layerStyles).
// 여백은 상자의 최소 높이로 남는다(→ decisions/motion.md).
const listClass = css({
  margin: 0,
  padding: "1.5",
  listStyle: "none",
  minHeight: 0,
  overflowY: "auto",
  transitionProperty: "padding",
  transitionDuration: "fast",
  transitionTimingFunction: "out",
  _motionReduce: { transition: "none" },
  '[data-collapsed="true"] > &': { paddingBlock: 0 },
});

const itemClass = css({
  width: "100%",
  "& span": {
    width: "100%",
    textAlign: "left",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

export function RecentFilesSection() {
  const recentFiles = useWorkspaceStore((state) => state.recentFiles);
  const collapsed = useRecentSectionStore((state) => state.collapsed);
  const listRef = useRef<HTMLUListElement>(null);
  const [current, setCurrent] = useState<string | null>(null);
  if (recentFiles.length === 0) {
    return null;
  }
  const stopPath = current !== null && recentFiles.includes(current) ? current : recentFiles[0];

  // 키보드 탐색 규칙 → document-model.md#최근-파일.
  // Enter 활성화는 버튼 기본 동작이라 여기 없다.
  function onListKeyDown(event: React.KeyboardEvent): void {
    const buttons = [...(listRef.current?.querySelectorAll<HTMLElement>("button") ?? [])];
    if (buttons.length === 0) {
      return;
    }
    const index = buttons.findIndex((button) => button === document.activeElement);
    let next: number;
    switch (event.key) {
      case "ArrowDown":
        next = Math.min(index + 1, buttons.length - 1);
        break;
      case "ArrowUp":
        next = Math.max(index - 1, 0);
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = buttons.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const target = buttons[next];
    if (target) {
      setCurrent(target.dataset.path ?? null);
      target.focus();
    }
  }

  return (
    <section className={sectionClass} data-testid="recent-files-section">
      <button
        type="button"
        className={headerClass}
        aria-expanded={!collapsed}
        data-testid="recent-files-toggle"
        onClick={toggleRecentSection}
      >
        <ChevronRightIcon className={chevronClass} />
        {STRINGS.recentFilesLabel}
      </button>
      <div className={collapseClass} data-collapsed={collapsed} aria-hidden={collapsed}>
        <ul
          ref={listRef}
          className={listClass}
          data-testid="recent-files"
          onKeyDown={onListKeyDown}
        >
          {recentFiles.map((path) => (
            <li key={path}>
              <Button
                variant="ghost"
                size="sm"
                className={itemClass}
                title={path}
                data-path={path}
                tabIndex={path === stopPath ? 0 : -1}
                onFocus={() => setCurrent(path)}
                onClick={() => void openPathInTab(path)}
              >
                <span>{entryNameOf(path)}</span>
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
