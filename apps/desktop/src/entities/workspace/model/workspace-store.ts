import { create } from "zustand";

import type { TreeNode } from "@shared/ipc";

// 파일 트리 상태 — 구조: .claude/docs/document-model.md#파일-트리-사이드바,
// read_dir 계약: rust-commands.md.

/** 프론트 트리 노드 — IPC TreeNode(한 단계 항목)에 조립된 children이 얹힌다. */
export interface FileTreeNode extends TreeNode {
  children?: FileTreeNode[];
}

interface WorkspaceState {
  /** 사이드바에 표시할 루트 폴더(canonical 경로 — 다이얼로그 반환값). null = 폴더 없음. */
  rootDir: string | null;
  fileTree: FileTreeNode[];
  /** 펼쳐진 폴더 경로 — 에디터 표현 상태다. 영속화하지 않는다(→ editor-strategy.md 접힘 영속화와 동일 원칙). */
  expandedDirs: string[];
}

interface WorkspaceActions {
  /** 루트 폴더를 연다 — 이전 트리·펼침 상태는 버린다(새 워크스페이스). */
  openRoot(rootDir: string, entries: TreeNode[]): void;
  /** read_dir 결과를 해당 폴더의 children으로 붙인다(빈 배열 = 빈 폴더로 기록). */
  setChildren(dirPath: string, entries: TreeNode[]): void;
  setExpanded(dirPath: string, expanded: boolean): void;
  /**
   * 외부 변경 반영 — 한 단계 재읽기 결과로 그 목록을 병합한다
   * (→ document-model.md#파일-트리-사이드바). dirPath가 rootDir이면 루트 레벨을 갱신한다.
   */
  refreshLevel(dirPath: string, entries: TreeNode[]): void;
}

export type WorkspaceStore = WorkspaceState & WorkspaceActions;

// 병합·조립은 참조를 보존한다 — "안 바뀐 것은 같은 참조"가 TreeItem memo의 전제다.

/**
 * 재읽기 병합 — 새 목록을 채택하되, 경로·종류가 같은 기존 항목은 노드 참조를 재사용하고
 * (children 승계 포함), 결과가 기존과 동일하면 기존 배열을 그대로 반환한다.
 */
function mergeLevel(existing: FileTreeNode[] | undefined, entries: TreeNode[]): FileTreeNode[] {
  const previousNodes = existing ?? [];
  const byPath = new Map(previousNodes.map((node) => [node.path, node]));
  let changed = previousNodes.length !== entries.length;
  const merged = entries.map((entry, index) => {
    const previous = byPath.get(entry.path);
    if (previous && previous.kind === entry.kind && previous.isSymlink === entry.isSymlink) {
      if (previousNodes[index] !== previous) {
        changed = true; // 순서가 바뀌었다.
      }
      return previous;
    }
    changed = true;
    return previous && previous.kind === entry.kind
      ? { ...entry, children: previous.children }
      : { ...entry };
  });
  return changed ? merged : previousNodes;
}

/** dirPath로 가는 경로의 가지만 새로 만든다 — 무관한 가지는 기존 참조를 그대로 반환한다. */
function updateBranch(
  nodes: FileTreeNode[],
  dirPath: string,
  update: (node: FileTreeNode) => FileTreeNode,
): FileTreeNode[] {
  let changed = false;
  const result = nodes.map((node) => {
    if (node.path === dirPath && node.kind === "dir") {
      const updated = update(node);
      if (updated !== node) {
        changed = true;
      }
      return updated;
    }
    if (node.children !== undefined && dirPath.startsWith(`${node.path}/`)) {
      const children = updateBranch(node.children, dirPath, update);
      if (children !== node.children) {
        changed = true;
        return { ...node, children };
      }
    }
    return node;
  });
  return changed ? result : nodes;
}

function refreshAt(nodes: FileTreeNode[], dirPath: string, entries: TreeNode[]): FileTreeNode[] {
  return updateBranch(nodes, dirPath, (node) => {
    // 안 읽은 폴더(children 부재)는 그대로 둔다 — 다음 펼침이 어차피 최신을 읽는다.
    if (node.children === undefined) {
      return node;
    }
    const children = mergeLevel(node.children, entries);
    return children === node.children ? node : { ...node, children };
  });
}

function attachChildren(
  nodes: FileTreeNode[],
  dirPath: string,
  entries: TreeNode[],
): FileTreeNode[] {
  return updateBranch(nodes, dirPath, (node) => ({
    ...node,
    children: entries.map((entry) => ({ ...entry })),
  }));
}

export const useWorkspaceStore = create<WorkspaceStore>()((set) => ({
  rootDir: null,
  fileTree: [],
  expandedDirs: [],

  openRoot(rootDir, entries) {
    set({
      rootDir,
      fileTree: entries.map((entry) => ({ ...entry })),
      expandedDirs: [],
    });
  },

  setChildren(dirPath, entries) {
    set((state) => ({ fileTree: attachChildren(state.fileTree, dirPath, entries) }));
  },

  refreshLevel(dirPath, entries) {
    set((state) => {
      const fileTree =
        state.rootDir !== null && dirPath === state.rootDir
          ? mergeLevel(state.fileTree, entries)
          : refreshAt(state.fileTree, dirPath, entries);
      if (fileTree === state.fileTree) {
        return state; // 구성 무변경 — 상태를 만들지 않아 구독자 리렌더가 없다.
      }
      // 사라진 폴더의 펼침 상태는 함께 정리한다.
      const expandedDirs = state.expandedDirs.filter(
        (path) => findTreeNode(fileTree, path)?.kind === "dir",
      );
      return {
        fileTree,
        expandedDirs:
          expandedDirs.length === state.expandedDirs.length ? state.expandedDirs : expandedDirs,
      };
    });
  },

  setExpanded(dirPath, expanded) {
    set((state) => {
      const isExpanded = state.expandedDirs.includes(dirPath);
      if (expanded === isExpanded) {
        return state;
      }
      return {
        expandedDirs: expanded
          ? [...state.expandedDirs, dirPath]
          : state.expandedDirs.filter((path) => path !== dirPath),
      };
    });
  },
}));

/** 경로로 트리 노드를 찾는다 — feature(펼치기)가 "아직 안 읽음"을 판정할 때 쓴다. */
export function findTreeNode(nodes: FileTreeNode[], path: string): FileTreeNode | undefined {
  for (const node of nodes) {
    if (node.path === path) {
      return node;
    }
    if (node.children) {
      const found = findTreeNode(node.children, path);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
}
