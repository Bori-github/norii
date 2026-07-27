import { useEffect, useRef } from "react";
import { css } from "styled-system/css";

import { requestDeleteEntry } from "@features/manage-entries";
import { STRINGS } from "@shared/config";

import type { EntryMenu } from "../model/context-menu-store";
import { closeEntryMenu } from "../model/context-menu-store";
import { startCreate, startRename } from "../model/entry-edit-store";

// 트리 항목의 컨텍스트 메뉴 — 진입점 규칙: .claude/docs/document-model.md#파일-트리-사이드바.

/** 화면 밖으로 나가지 않게 두는 여백. */
const VIEWPORT_MARGIN = 8;

const menuClass = css({
  position: "fixed",
  zIndex: 20,
  minWidth: "36",
  padding: "1",
  borderRadius: "lg",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "border",
  background: "bg.paper",
  boxShadow: "0 1px 1px rgba(0, 0, 0, 0.08), 0 12px 32px rgba(0, 0, 0, 0.22)",
});

const itemClass = css({
  display: "flex",
  width: "100%",
  alignItems: "center",
  border: "none",
  background: "transparent",
  color: "text",
  fontSize: "xs",
  textAlign: "left",
  borderRadius: "sm",
  paddingX: "2.5",
  paddingY: "1",
  cursor: "pointer",
  _hover: { background: "accent", color: "white" },
  _focusVisible: { outline: "none", background: "accent", color: "white" },
});

const dangerItemClass = css({
  color: "status.danger",
  _hover: { background: "status.danger", color: "white" },
  _focusVisible: { background: "status.danger", color: "white" },
});

const separatorClass = css({
  height: "1px",
  marginX: "2.5",
  marginY: "1",
  background: "border",
});

interface MenuAction {
  key: string;
  label: string;
  danger?: boolean;
  run: () => void;
}

export function EntryContextMenu({ menu }: { menu: EntryMenu }) {
  const menuRef = useRef<HTMLDivElement>(null);
  const { target } = menu;
  const anchor = target?.path ?? null;

  const actions: MenuAction[] = [
    {
      key: "new-file",
      label: STRINGS.menuNewFileLabel,
      run: () => void startCreate("file", anchor),
    },
    { key: "new-dir", label: STRINGS.menuNewDirLabel, run: () => void startCreate("dir", anchor) },
  ];
  if (target !== null) {
    actions.push(
      {
        key: "rename",
        label: STRINGS.menuRenameLabel,
        run: () => startRename(target.path, target.kind),
      },
      {
        key: "delete",
        label: STRINGS.menuDeleteLabel,
        danger: true,
        run: () => requestDeleteEntry(target.path, target.name),
      },
    );
  }

  useEffect(() => {
    const element = menuRef.current;
    if (element === null) {
      return;
    }
    element.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    // 우클릭 지점이 화면 끝이면 넘친 만큼 left/top을 줄여 메뉴가 화면 안에 들어오게 한다.
    const rect = element.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      element.style.left = `${window.innerWidth - rect.width - VIEWPORT_MARGIN}px`;
    }
    if (rect.bottom > window.innerHeight) {
      element.style.top = `${window.innerHeight - rect.height - VIEWPORT_MARGIN}px`;
    }
  }, []);

  useEffect(() => {
    // 메뉴 밖을 누르면 닫는다. click이 아니라 mousedown이라야 그 클릭이 트리에 닿기 전에 닫힌다.
    const onPointerDown = (event: MouseEvent): void => {
      if (!menuRef.current?.contains(event.target as Node)) {
        closeEntryMenu();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const moveFocus = (delta: number): void => {
    const items = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const index = items.findIndex((item) => item === document.activeElement);
    items[Math.max(0, Math.min(index + delta, items.length - 1))]?.focus();
  };

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={STRINGS.entryMenuLabel}
      className={menuClass}
      style={{ left: menu.x, top: menu.y }}
      data-testid="entry-context-menu"
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") {
          closeEntryMenu();
        } else if (event.key === "ArrowDown") {
          event.preventDefault();
          moveFocus(1);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          moveFocus(-1);
        }
      }}
    >
      {actions.map((action) => (
        <div key={action.key}>
          {action.danger === true && <div className={separatorClass} />}
          <button
            type="button"
            role="menuitem"
            className={action.danger === true ? `${itemClass} ${dangerItemClass}` : itemClass}
            data-testid={`menu-${action.key}`}
            onClick={() => {
              closeEntryMenu();
              action.run();
            }}
          >
            {action.label}
          </button>
        </div>
      ))}
    </div>
  );
}
