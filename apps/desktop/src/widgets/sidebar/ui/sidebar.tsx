import { useEffect, useRef } from "react";
import { css } from "styled-system/css";

import { useWorkspaceStore } from "@entities/workspace";
import { openPathInTab } from "@features/open-file";
import { openFolderInteractive, toggleDir } from "@features/open-folder";
import { SettingsButton } from "@features/toggle-settings";
import { STRINGS } from "@shared/config";
import { entryNameOf } from "@shared/lib";
import { Button, FilePlusIcon, FolderPlusIcon, IconButton } from "@shared/ui";

import { openEntryMenu, useContextMenuStore } from "../model/context-menu-store";
import { startCreate, useEntryEditStore } from "../model/entry-edit-store";
import { EntryContextMenu } from "./entry-context-menu";
import { setTreeNavCurrent, useTreeNavStore } from "../model/tree-nav-store";
import { EntryNameInput } from "./entry-name-input";
import { TreeItem } from "./tree-item";

// 사이드바는 유리(크롬)다 — 탭바·상태바와 같은 표면 역할(→ DESIGN.md 표면 표).
// 트리는 파일시스템의 위계를 보여줄 뿐이다 — 전체 인덱싱이 아니라 단순 트리 표시
// (→ document-model.md#파일-트리-사이드바 · 비목표 경계).

const sidebarClass = css({
  display: "flex",
  flexDirection: "column",
  width: "60",
  flexShrink: 0,
  minHeight: 0,
  background: "bg.chrome",
  borderRightWidth: "1px",
  borderRightStyle: "solid",
  borderRightColor: "border",
});

const headerClass = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1.5",
  paddingX: "3",
  height: "9",
  fontSize: "sm",
  fontWeight: "medium",
  color: "text",
  whiteSpace: "nowrap",
});

const headerNameClass = css({ overflow: "hidden", textOverflow: "ellipsis" });

const headerActionsClass = css({
  display: "flex",
  alignItems: "center",
  gap: "1.5",
  flexShrink: 0,
});

const treeClass = css({
  flex: 1,
  overflowY: "auto",
  listStyle: "none",
  margin: 0,
  padding: 0,
  paddingTop: "1.5",
  // 마지막 줄에서 이름을 고칠 때 툴팁이 줄 아래로 나온다 — 그만큼 스크롤 여지를 둔다.
  paddingBottom: "10",
});

const footerClass = css({
  display: "flex",
  justifyContent: "flex-end",
  flexShrink: 0,
  padding: "1.5",
  borderTopWidth: "1px",
  borderTopStyle: "solid",
  borderTopColor: "border",
});

const emptyClass = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "3",
  flex: 1,
  paddingX: "4",
  fontSize: "sm",
  color: "text",
  textAlign: "center",
});

// 정지점을 index로 옮기고 포커스한다(범위는 [0, 끝]으로 물린다).
function focusAt(list: HTMLElement[], index: number): void {
  const el = list[Math.max(0, Math.min(index, list.length - 1))];
  if (el) {
    setTreeNavCurrent(el.dataset.path ?? "");
    el.focus();
  }
}

// 트리 키보드 탐색 — WAI-ARIA Tree View. 컨테이너 한 곳에서 처리한다: 포커스된 treeitem은
// DOM 순서(곧 보이는 순서)로 알 수 있어, 노드마다 핸들러를 달지 않아도 이웃을 찾을 수 있다.
function useTreeKeyboard(treeRef: React.RefObject<HTMLUListElement | null>) {
  return function onKeyDown(event: React.KeyboardEvent): void {
    const list = [...(treeRef.current?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? [])];
    if (list.length === 0) {
      return;
    }
    const focused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement.closest<HTMLElement>('[role="treeitem"]')
        : null;
    const current = focused && list.includes(focused) ? focused : list[0];
    if (!current) {
      return;
    }
    const index = list.indexOf(current);
    const isDir = current.dataset.testid === "tree-dir";
    const isExpanded = current.getAttribute("aria-expanded") === "true";
    const path = current.dataset.path ?? "";

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusAt(list, index + 1);
        return;
      case "ArrowUp":
        event.preventDefault();
        focusAt(list, index - 1);
        return;
      case "Home":
        event.preventDefault();
        focusAt(list, 0);
        return;
      case "End":
        event.preventDefault();
        focusAt(list, list.length - 1);
        return;
      case "ArrowRight":
        event.preventDefault();
        // 접힌 폴더는 펼치고 자리를 지킨다. 이미 펼친 폴더는 첫 자식으로. 파일은 무동작.
        if (isDir && !isExpanded) {
          void toggleDir(path);
        } else if (isDir) {
          focusAt(list, index + 1);
        }
        return;
      case "ArrowLeft": {
        event.preventDefault();
        // 펼친 폴더는 접고, 그 외는 부모로 올라간다.
        if (isDir && isExpanded) {
          void toggleDir(path);
          return;
        }
        const parent = current.parentElement?.closest<HTMLElement>('[role="treeitem"]');
        if (parent) {
          setTreeNavCurrent(parent.dataset.path ?? "");
          parent.focus();
        }
        return;
      }
      case "Enter":
      case " ":
        event.preventDefault();
        if (isDir) {
          void toggleDir(path);
        } else {
          void openPathInTab(path);
        }
        return;
      default:
    }
  };
}

export function Sidebar() {
  const rootDir = useWorkspaceStore((state) => state.rootDir);
  const fileTree = useWorkspaceStore((state) => state.fileTree);
  const currentPath = useTreeNavStore((state) => state.currentPath);
  const edit = useEntryEditStore((state) => state.edit);
  const menu = useContextMenuStore((state) => state.menu);
  const treeRef = useRef<HTMLUListElement>(null);
  const onTreeKeyDown = useTreeKeyboard(treeRef);

  // Tab 정지점은 항상 하나여야 한다 — currentPath가 접혀 사라지거나 아직 없으면 첫 노드로
  // 자가 복구한다. 정지점이 이미 있으면 아무것도 하지 않아 반복되지 않는다.
  useEffect(() => {
    const list = treeRef.current?.querySelectorAll<HTMLElement>('[role="treeitem"]');
    if (!list || list.length === 0) {
      return;
    }
    const nodes = [...list];
    const hasStop = nodes.some((el) => el.tabIndex === 0);
    const first = nodes[0];
    if (!hasStop && first) {
      setTreeNavCurrent(first.dataset.path ?? "");
    }
  }, [fileTree, currentPath]);

  if (rootDir === null) {
    return (
      <nav className={sidebarClass} aria-label={STRINGS.sidebarTreeLabel} data-testid="sidebar">
        <div className={emptyClass}>
          <span>{STRINGS.sidebarEmptyBody}</span>
          <Button data-testid="open-folder" onClick={() => void openFolderInteractive()}>
            {STRINGS.openFolderButtonLabel}
          </Button>
        </div>
        <div className={footerClass}>
          <SettingsButton />
        </div>
      </nav>
    );
  }

  return (
    <nav className={sidebarClass} aria-label={STRINGS.sidebarTreeLabel} data-testid="sidebar">
      <div className={headerClass}>
        <span className={headerNameClass} title={rootDir}>
          {entryNameOf(rootDir)}
        </span>
        <div className={headerActionsClass}>
          <IconButton
            size="xs"
            label={STRINGS.newFileButtonLabel}
            data-testid="new-file"
            onClick={() => void startCreate("file", null)}
          >
            <FilePlusIcon />
          </IconButton>
          <IconButton
            size="xs"
            label={STRINGS.newDirButtonLabel}
            data-testid="new-dir"
            onClick={() => void startCreate("dir", null)}
          >
            <FolderPlusIcon />
          </IconButton>
          <Button
            variant="ghost"
            size="xs"
            data-testid="open-folder"
            onClick={() => void openFolderInteractive()}
          >
            {STRINGS.openFolderButtonLabel}
          </Button>
        </div>
      </div>
      <ul
        ref={treeRef}
        className={treeClass}
        role="tree"
        aria-label={STRINGS.sidebarTreeLabel}
        data-testid="file-tree"
        onKeyDown={onTreeKeyDown}
        // 빈 영역 우클릭 — 항목의 onContextMenu는 전파를 멈추므로 여기는 항목 밖에서만 뜬다.
        onContextMenu={(event) => {
          event.preventDefault();
          openEntryMenu({ target: null, x: event.clientX, y: event.clientY });
        }}
      >
        {fileTree.map((node) => (
          <TreeItem key={node.path} node={node} depth={0} />
        ))}
        {edit?.mode === "create" && edit.dir === rootDir && <EntryNameInput edit={edit} />}
      </ul>
      {menu !== null && <EntryContextMenu key={menu.target?.path ?? ""} menu={menu} />}
      <div className={footerClass}>
        <SettingsButton />
      </div>
    </nav>
  );
}
