import { memo } from "react";
import { css } from "styled-system/css";

import { useDocumentStore } from "@entities/document";
import type { FileTreeNode } from "@entities/workspace";
import { useWorkspaceStore } from "@entities/workspace";
import { openPathInTab } from "@features/open-file";
import { toggleDir } from "@features/open-folder";
import { STRINGS } from "@shared/config";
import { ChevronRightIcon } from "@shared/ui";

import { setTreeNavCurrent, useTreeNavStore } from "../model/tree-nav-store";

// 트리 한 줄 — 폴더는 펼침 토글, 파일은 탭 열기. 들여쓰기는 깊이에 비례한다.
// 접근성은 WAI-ARIA 트리 패턴이다: li 자체가 treeitem(포커스 대상)이고 그 안에 별도 버튼을
// 두지 않는다(중첩 인터랙티브 금지). 화살표 탐색·roving tabindex는 sidebar가 소유한다.
// lazy 읽기·캐시 규칙은 features/open-folder가 소유한다(여기는 표시와 클릭 연결만).

// 선택(활성 파일)은 종이 배경, 포커스(비활성 행)는 hover 배경으로 표시한다(→ decisions/color-palette).
const treeItemClass = css({
  listStyle: "none",
  margin: 0,
  padding: 0,
  outline: "none",
  '&:focus:not([aria-selected="true"]) > [data-row]': { background: "bg.hover" },
  '&[aria-selected="true"] > [data-row]': { background: "bg.paper" },
});

const rowClass = css({
  display: "flex",
  alignItems: "center",
  gap: "1.5",
  marginX: "1.5",
  marginY: "0.5",
  paddingLeft: "2",
  paddingRight: "2",
  paddingY: "1.5",
  borderRadius: "md",
  color: "text",
  fontSize: "sm",
  cursor: "pointer",
  whiteSpace: "nowrap",
  userSelect: "none",
  _hover: { background: "bg.hover" },
});

const chevronClass = css({
  flexShrink: 0,
  width: "3.5",
  height: "3.5",
  transitionProperty: "transform",
  transitionDuration: "fast",
  // 자기 li의 펼침만 본다 — `>` 사슬로 조상(펼친 부모)의 셰브론까지 도는 것을 막는다.
  '[aria-expanded="true"] > [data-row] > &': { transform: "rotate(90deg)" },
});

// 파일 줄에는 셰브론이 없다 — 같은 폭의 자리로 이름 열을 맞춘다.
const chevronGapClass = css({ flexShrink: 0, width: "3.5", height: "3.5" });

const nameClass = css({ overflow: "hidden", textOverflow: "ellipsis" });

const symlinkBadgeClass = css({ flexShrink: 0, fontSize: "xs", opacity: 0.7 });

// 중첩 그룹은 왼쪽 세로 가이드 선으로 그 폴더의 자식 범위를 잇는다(시안 매칭). marginLeft가
// 한 단계 들여쓰기를 겸하고, 그 값이 곧 가이드 선의 x다 — 부모 셰브론 중심(줄 marginX 6 +
// paddingLeft 8 + 셰브론 반폭 7 = 21px)에 맞춰 선이 셰브론 아래로 내려가게 한다.
const groupClass = css({
  listStyle: "none",
  margin: 0,
  padding: 0,
  marginLeft: "21px",
  borderLeft: "1px solid",
  borderColor: "border.muted",
});

const emptyClass = css({
  fontSize: "xs",
  color: "text.muted",
  fontStyle: "italic",
  paddingY: "1.5",
  paddingLeft: "3.5",
  paddingRight: "2",
  whiteSpace: "nowrap",
});

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
  // roving tabindex — 보이는 노드 중 하나만 Tab 정지점이다(→ model/tree-nav-store).
  const isCurrent = useTreeNavStore((state) => state.currentPath === node.path);

  const symlinkBadge = node.isSymlink && (
    <span className={symlinkBadgeClass} aria-label={STRINGS.symlinkBadgeLabel}>
      ↪
    </span>
  );

  if (node.kind === "dir") {
    return (
      <li
        role="treeitem"
        aria-level={depth + 1}
        aria-expanded={expanded}
        tabIndex={isCurrent ? 0 : -1}
        className={treeItemClass}
        data-testid="tree-dir"
        data-path={node.path}
        onClick={(event) => {
          // treeitem이 중첩돼 있어 클릭이 부모 treeitem으로 버블하면 상위 폴더까지 토글된다 —
          // 자기 항목에서 멈춘다.
          event.stopPropagation();
          // WebKit은 tabindex만 있는 li를 클릭해도 포커스를 주지 않는다 — 클릭으로 키보드
          // 탐색을 시작하려면 명시적으로 포커스한다(→ sidebar.browser.test).
          event.currentTarget.focus();
          setTreeNavCurrent(node.path);
          void toggleDir(node.path);
        }}
      >
        <div data-row className={rowClass}>
          <ChevronRightIcon className={chevronClass} />
          <span className={nameClass}>{node.name}</span>
          {symlinkBadge}
        </div>
        {expanded && node.children !== undefined && (
          <ul role="group" className={groupClass}>
            {node.children.length > 0 ? (
              node.children.map((child) => (
                <TreeItem key={child.path} node={child} depth={depth + 1} />
              ))
            ) : (
              // 빈 것은 빈 group이 이미 알린다 — 이 줄은 눈으로 보는 힌트라 SR에서 감춘다.
              // 클릭은 아무 일도 하지 않지만, 부모 폴더 treeitem으로 버블하면 폴더가 접히므로 멈춘다.
              <li
                aria-hidden="true"
                className={emptyClass}
                data-testid="tree-empty"
                onClick={(event) => event.stopPropagation()}
              >
                {STRINGS.sidebarEmptyFolder}
              </li>
            )}
          </ul>
        )}
      </li>
    );
  }

  return (
    <li
      role="treeitem"
      aria-level={depth + 1}
      aria-selected={isActiveFile}
      tabIndex={isCurrent ? 0 : -1}
      className={treeItemClass}
      data-testid="tree-file"
      data-path={node.path}
      onClick={(event) => {
        event.stopPropagation();
        event.currentTarget.focus();
        setTreeNavCurrent(node.path);
        // 클릭은 포커스를 트리에 남긴다(방향키 탐색 유지 → document-model.md#파일-트리-사이드바).
        void openPathInTab(node.path, { focusEditor: false });
      }}
    >
      <div data-row className={rowClass}>
        <span className={chevronGapClass} aria-hidden="true" />
        <span className={nameClass}>{node.name}</span>
        {symlinkBadge}
      </div>
    </li>
  );
});
