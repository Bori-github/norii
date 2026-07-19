import { findTreeNode, useWorkspaceStore } from "@entities/workspace";
import { STRINGS } from "@shared/config";
import { ipc } from "@shared/ipc";
import { notifyIpcError } from "@shared/ui";

import { syncTreeWatch } from "./tree-refresh";

// 폴더 열기·트리 탐색 — 정책의 단일 출처: .claude/docs/document-model.md#파일-트리-사이드바.
// 다이얼로그가 허용 루트를 등록하고(→ rust-commands.md show_open_folder_dialog),
// read_dir는 호출당 한 단계만 읽는다(레벨별 lazy — 펼칠 때 그 폴더를 읽는다).

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
  const previousRoot = useWorkspaceStore.getState().rootDir;
  // 감시를 먼저 세운다 — 읽기 스냅숏과 감시 확립 사이에 생긴 변경은 스냅숏에도
  // 이벤트에도 없어 영구 누락된다. 감시가 먼저면 스냅숏 이후는 전부 이벤트로 잡힌다.
  await syncTreeWatch(root);
  try {
    const entries = await ipc.readDir(root);
    useWorkspaceStore.getState().openRoot(root, entries);
  } catch (error) {
    // 루트 한 단계를 읽지 못하면 워크스페이스를 세우지 않는다 — 빈 트리가 "빈 폴더"로
    // 보이면 오해를 만든다(빈 배열 = 빈 폴더의 의미를 지킨다).
    notifyIpcError(STRINGS.openFolderFailedTitle, error);
    // 워크스페이스가 서지 않았는데 감시만 새 루트를 보면 기존 트리가 낡는다 — 되돌린다.
    void syncTreeWatch(previousRoot);
  }
}

/**
 * 폴더 펼침/접힘 토글. 아직 안 읽은 폴더(children 부재)는 첫 펼침에 read_dir로 읽고,
 * 읽어 둔 폴더는 IPC 없이 다시 펼친다(캐시 — 외부 변경 반영은 폴더 감시가 담당한다).
 * 읽기에 실패하면 펼치지 않는다 — 빈 폴더로 오해되는 상태를 만들지 않는다.
 */
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
