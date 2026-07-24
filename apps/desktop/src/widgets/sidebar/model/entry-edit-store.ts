import { create } from "zustand";

import type { FileTreeNode } from "@entities/workspace";
import { findTreeNode, useWorkspaceStore } from "@entities/workspace";
import type { EntryKind } from "@features/manage-entries";
import { expandDir } from "@features/open-folder";

// 트리 안 인라인 편집 상태 — 한 번에 하나만 열린다(→ document-model.md#파일-트리-사이드바).

export interface EntryEdit {
  mode: "create" | "rename";
  /** 만들거나 이름을 바꿀 항목이 놓인 폴더. */
  dir: string;
  kind: EntryKind;
  /** 이름 변경 대상 — 생성이면 없다. */
  path?: string;
}

interface EntryEditState {
  edit: EntryEdit | null;
}

export const useEntryEditStore = create<EntryEditState>(() => ({ edit: null }));

function parentOf(path: string): string {
  const index = path.lastIndexOf("/");
  return index > 0 ? path.slice(0, index) : path;
}

/** 만들 폴더를 고른다(→ document-model.md#파일-트리-사이드바). */
function targetDir(anchorPath: string | null, rootDir: string, tree: FileTreeNode[]): string {
  if (anchorPath === null) {
    return rootDir;
  }
  const node = findTreeNode(tree, anchorPath);
  if (node === undefined) {
    return rootDir;
  }
  return node.kind === "dir" ? node.path : parentOf(node.path);
}

export async function startCreate(kind: EntryKind, anchorPath: string | null): Promise<void> {
  const { rootDir, fileTree } = useWorkspaceStore.getState();
  if (rootDir === null) {
    return;
  }
  const dir = targetDir(anchorPath, rootDir, fileTree);
  if (dir !== rootDir) {
    await expandDir(dir);
  }
  useEntryEditStore.setState({ edit: { mode: "create", dir, kind } });
}

export function startRename(path: string, kind: EntryKind): void {
  useEntryEditStore.setState({ edit: { mode: "rename", dir: parentOf(path), kind, path } });
}

export function cancelEntryEdit(): void {
  useEntryEditStore.setState({ edit: null });
}
