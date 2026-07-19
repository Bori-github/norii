import { css } from "styled-system/css";

import { useWorkspaceStore } from "@entities/workspace";
import { openFolderInteractive } from "@features/open-folder";
import { STRINGS } from "@shared/config";

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

export function Sidebar() {
  const rootDir = useWorkspaceStore((state) => state.rootDir);
  const fileTree = useWorkspaceStore((state) => state.fileTree);

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
      <ul className={treeClass} data-testid="file-tree">
        {fileTree.map((node) => (
          <TreeItem key={node.path} node={node} depth={0} />
        ))}
      </ul>
    </nav>
  );
}
