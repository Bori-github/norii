import { findTreeNode, useWorkspaceStore } from "@entities/workspace";
import { STRINGS } from "@shared/config";
import { ipc } from "@shared/ipc";
import { notifyIpcError } from "@shared/ui";

import { syncTreeWatch } from "./tree-refresh";

// 폴더 열기·트리 탐색 — 정책: .claude/docs/document-model.md#파일-트리-사이드바,
// 커맨드 계약: rust-commands.md(show_open_folder_dialog·read_dir).

export async function openFolderInteractive(): Promise<void> {
  let root: string | null;
  try {
    root = await ipc.showOpenFolderDialog();
  } catch (error) {
    notifyIpcError(STRINGS.openFolderFailedTitle, error);
    return;
  }
  if (root === null) {
    return; // 사용자가 다이얼로그를 취소했다.
  }
  await openFolderAtPath(root);
}

/**
 * 경로로 워크스페이스를 연다 — 다이얼로그 이후의 공통 경로이며, E2E 훅도 이 함수를 쓴다
 * (WebDriver는 네이티브 다이얼로그를 열 수 없다 → testing.md). 경로는 허용 루트여야 한다.
 */
export async function openFolderAtPath(root: string): Promise<void> {
  const previousRoot = useWorkspaceStore.getState().rootDir;
  // 순서 제약 — 감시를 먼저 세우고 읽는다.
  await syncTreeWatch(root);
  try {
    const entries = await ipc.readDir(root);
    useWorkspaceStore.getState().openRoot(root, entries);
  } catch (error) {
    notifyIpcError(STRINGS.openFolderFailedTitle, error);
    // 워크스페이스가 서지 않았는데 감시만 새 루트를 보면 기존 트리가 낡는다 — 되돌린다.
    void syncTreeWatch(previousRoot);
  }
}

/** 폴더 펼침/접힘 토글(레벨별 lazy·캐시 재펼침 → document-model.md#파일-트리-사이드바). */
export async function toggleDir(path: string): Promise<void> {
  const store = useWorkspaceStore.getState();
  if (store.expandedDirs.includes(path)) {
    store.setExpanded(path, false);
    return;
  }
  const node = findTreeNode(store.fileTree, path);
  if (node !== undefined && node.children === undefined) {
    try {
      const entries = await ipc.readDir(path);
      useWorkspaceStore.getState().setChildren(path, entries);
    } catch (error) {
      notifyIpcError(STRINGS.expandDirFailedTitle, error);
      return;
    }
  }
  useWorkspaceStore.getState().setExpanded(path, true);
}
