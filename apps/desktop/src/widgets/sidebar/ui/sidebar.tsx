import { useEffect, useRef } from "react";
import { css } from "styled-system/css";

import { useWorkspaceStore } from "@entities/workspace";
import { openPathInTab } from "@features/open-file";
import { openFolderInteractive, toggleDir } from "@features/open-folder";
import { STRINGS } from "@shared/config";

import { setTreeNavCurrent, useTreeNavStore } from "../model/tree-nav-store";
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
  borderRight: "1px solid",
  borderColor: "border",
});

const headerClass = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1",
  paddingX: "2",
  paddingY: "1",
  fontSize: "xs",
  fontWeight: "medium",
  color: "text",
  whiteSpace: "nowrap",
});

const headerNameClass = css({ overflow: "hidden", textOverflow: "ellipsis" });

const folderButtonClass = css({
  border: "none",
  background: "transparent",
  color: "text",
  fontSize: "xs",
  borderRadius: "sm",
  paddingX: "1.5",
  paddingY: "0.5",
  cursor: "pointer",
  flexShrink: 0,
  _hover: { background: "bg.hover" },
  _focusVisible: { outline: "2px solid", outlineColor: "accent", outlineOffset: "-2px" },
});

const treeClass = css({
  flex: 1,
  overflowY: "auto",
  listStyle: "none",
  margin: 0,
  padding: 0,
  paddingTop: "1.5",
  paddingBottom: "2",
});

const emptyClass = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "2",
  flex: 1,
  paddingX: "3",
  fontSize: "xs",
  color: "text",
  textAlign: "center",
});

const emptyButtonClass = css({
  border: "1px solid",
  borderColor: "border",
  background: "transparent",
  color: "text",
  fontSize: "sm",
  borderRadius: "md",
  paddingX: "3",
  paddingY: "1",
  cursor: "pointer",
  _hover: { background: "bg.hover" },
  _focusVisible: { outline: "2px solid", outlineColor: "accent", outlineOffset: "2px" },
});

function folderNameOf(path: string): string {
  const name = path.split(/[/\\]/).at(-1);
  return name && name.length > 0 ? name : path;
}

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
          <button
            type="button"
            className={emptyButtonClass}
            data-testid="open-folder"
            onClick={() => void openFolderInteractive()}
          >
            {STRINGS.openFolderButtonLabel}
          </button>
        </div>
      </nav>
    );
  }

  return (
    <nav className={sidebarClass} aria-label={STRINGS.sidebarTreeLabel} data-testid="sidebar">
      <div className={headerClass}>
        <span className={headerNameClass} title={rootDir}>
          {folderNameOf(rootDir)}
        </span>
        <button
          type="button"
          className={folderButtonClass}
          aria-label={STRINGS.openFolderButtonLabel}
          data-testid="open-folder"
          onClick={() => void openFolderInteractive()}
        >
          {STRINGS.openFolderButtonLabel}
        </button>
      </div>
      <ul
        ref={treeRef}
        className={treeClass}
        role="tree"
        aria-label={STRINGS.sidebarTreeLabel}
        data-testid="file-tree"
        onKeyDown={onTreeKeyDown}
      >
        {fileTree.map((node) => (
          <TreeItem key={node.path} node={node} depth={0} />
        ))}
      </ul>
    </nav>
  );
}
