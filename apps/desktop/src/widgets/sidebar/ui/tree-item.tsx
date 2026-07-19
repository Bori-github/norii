import { memo } from "react";
import { css } from "styled-system/css";

import { useDocumentStore } from "@entities/document";
import type { FileTreeNode } from "@entities/workspace";
import { useWorkspaceStore } from "@entities/workspace";
import { openPathInTab } from "@features/open-file";
import { toggleDir } from "@features/open-folder";
import { STRINGS } from "@shared/config";
import { ChevronRightIcon } from "@shared/ui";

// 트리 한 줄 — 폴더는 펼침 토글, 파일은 탭 열기. 들여쓰기는 깊이에 비례한다.
// lazy 읽기·캐시 규칙은 features/open-folder가 소유한다(여기는 표시와 클릭 연결만).

const rowClass = css({
  display: "flex",
  alignItems: "center",
  gap: "1",
  width: "100%",
  border: "none",
  background: "transparent",
  color: "text",
  fontSize: "sm",
  paddingY: "0.5",
  paddingRight: "2",
  cursor: "pointer",
  whiteSpace: "nowrap",
  userSelect: "none",
  textAlign: "left",
  _hover: { background: "bg.hover" },
  _focusVisible: { outline: "2px solid", outlineColor: "accent", outlineOffset: "-2px" },
  // 활성 탭의 파일 — 탭바의 활성 탭과 같은 규칙: 배경(종이)으로 가른다(→ decisions/0004).
  '&[aria-current="true"]': { background: "bg.paper" },
});

const chevronClass = css({
  flexShrink: 0,
  width: "3.5",
  height: "3.5",
  transitionProperty: "transform",
  transitionDuration: "fast",
  '[aria-expanded="true"] > &': { transform: "rotate(90deg)" },
});

// 파일 줄에는 셰브론이 없다 — 같은 폭의 자리로 이름 열을 맞춘다.
const chevronGapClass = css({ flexShrink: 0, width: "3.5", height: "3.5" });

const nameClass = css({ overflow: "hidden", textOverflow: "ellipsis" });

const symlinkBadgeClass = css({ flexShrink: 0, fontSize: "xs", opacity: 0.7 });

const groupClass = css({ listStyle: "none", margin: 0, padding: 0 });

/** 들여쓰기 — 깊이는 런타임 값이라 Panda 정적 추출 대신 인라인 스타일로 준다. */
function indentStyle(depth: number): React.CSSProperties {
  return { paddingLeft: `${depth * 12 + 8}px` };
}

// memo — 스토어의 참조 보존(무변경 병합이 기존 노드를 재사용)과 짝을 이룬다.
// node 참조가 같으면 그 가지의 리렌더를 건너뛴다(자동 저장마다 트리 전체가 그려지지 않게).
export const TreeItem = memo(function TreeItem({
  node,
  depth,
}: {
  node: FileTreeNode;
  depth: number;
}) {
  const expanded = useWorkspaceStore((state) => state.expandedDirs.includes(node.path));
  const isActiveFile = useDocumentStore(
    (state) => state.tabs.find((tab) => tab.id === state.activeTabId)?.filePath === node.path,
  );

  const symlinkBadge = node.isSymlink && (
    <span className={symlinkBadgeClass} aria-label={STRINGS.symlinkBadgeLabel}>
      ↪
    </span>
  );

  if (node.kind === "dir") {
    return (
      <li className={groupClass}>
        <button
          type="button"
          className={rowClass}
          style={indentStyle(depth)}
          aria-expanded={expanded}
          data-testid="tree-dir"
          onClick={() => void toggleDir(node.path)}
        >
          <ChevronRightIcon className={chevronClass} />
          <span className={nameClass}>{node.name}</span>
          {symlinkBadge}
        </button>
        {expanded && node.children !== undefined && node.children.length > 0 && (
          <ul className={groupClass}>
            {node.children.map((child) => (
              <TreeItem key={child.path} node={child} depth={depth + 1} />
            ))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <li className={groupClass}>
      <button
        type="button"
        className={rowClass}
        style={indentStyle(depth)}
        aria-current={isActiveFile || undefined}
        data-testid="tree-file"
        onClick={() => void openPathInTab(node.path)}
      >
        <span className={chevronGapClass} aria-hidden="true" />
        <span className={nameClass}>{node.name}</span>
        {symlinkBadge}
      </button>
    </li>
  );
});
