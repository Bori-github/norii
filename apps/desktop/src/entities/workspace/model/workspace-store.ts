import { create } from "zustand";

import type { TreeNode } from "@shared/ipc";

// 파일 트리 상태 — 구조의 단일 출처: .claude/docs/document-model.md#파일-트리-사이드바.
// read_dir는 한 단계 목록만 반환하므로(→ rust-commands.md) 트리 조립은 여기(프론트)가
// 담당한다. children 부재 = 아직 안 읽음, [] = 빈 폴더 — 이 구분이 lazy 로딩의 기준이다.

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
   * 외부 변경 반영 — 한 단계를 다시 읽은 결과로 그 목록을 교체하되, 살아남은 항목의
   * 기존 children(하위 트리)은 경로 기준으로 보존한다(재읽기가 하위를 접지 않게 —
   * → document-model.md#파일-트리-사이드바). dirPath가 rootDir이면 루트 레벨을 갱신한다.
   */
  refreshLevel(dirPath: string, entries: TreeNode[]): void;
}

export type WorkspaceStore = WorkspaceState & WorkspaceActions;

/** 재읽기 병합 — 새 목록을 채택하되, 경로·종류가 같은 기존 항목의 children을 이어받는다. */
function mergeLevel(existing: FileTreeNode[] | undefined, entries: TreeNode[]): FileTreeNode[] {
  const byPath = new Map((existing ?? []).map((node) => [node.path, node]));
  return entries.map((entry) => {
    const previous = byPath.get(entry.path);
    return previous && previous.kind === entry.kind
      ? { ...entry, children: previous.children }
      : { ...entry };
  });
}

function refreshAt(nodes: FileTreeNode[], dirPath: string, entries: TreeNode[]): FileTreeNode[] {
  return nodes.map((node) => {
    if (node.path === dirPath && node.kind === "dir") {
      // 안 읽은 폴더(children 부재)는 그대로 둔다 — 다음 펼침이 어차피 최신을 읽는다.
      return node.children === undefined
        ? node
        : { ...node, children: mergeLevel(node.children, entries) };
    }
    if (node.children) {
      return { ...node, children: refreshAt(node.children, dirPath, entries) };
    }
    return node;
  });
}

function attachChildren(
  nodes: FileTreeNode[],
  dirPath: string,
  entries: TreeNode[],
): FileTreeNode[] {
  return nodes.map((node) => {
    if (node.path === dirPath && node.kind === "dir") {
      return { ...node, children: entries.map((entry) => ({ ...entry })) };
    }
    if (node.children) {
      return { ...node, children: attachChildren(node.children, dirPath, entries) };
    }
    return node;
  });
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
    set((state) => ({
      fileTree:
        state.rootDir !== null && dirPath === state.rootDir
          ? mergeLevel(state.fileTree, entries)
          : refreshAt(state.fileTree, dirPath, entries),
    }));
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
