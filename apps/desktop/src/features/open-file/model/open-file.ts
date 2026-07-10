import { useDocumentStore } from "@entities/document";
import { STRINGS } from "@shared/config";
import { ipc } from "@shared/ipc";
import { notifyIpcError } from "@shared/ui";

// 파일 열기 — 다이얼로그로 경로를 얻고(스코프 등록의 입구, → rust-commands.md#권한-capabilities)
// 탭으로 연다. 이미 열린 파일이면 그 탭을 활성화한다(중복 탭 금지 → document-model.md).

export async function openFileInteractive(): Promise<void> {
  let path: string | null;
  try {
    path = await ipc.showOpenDialog();
  } catch (error) {
    notifyIpcError(STRINGS.openFailedTitle, error);
    return;
  }
  if (path === null) {
    return; // 사용자가 다이얼로그를 취소했다.
  }
  await openPathInTab(path);
}

export async function openPathInTab(path: string): Promise<void> {
  const store = useDocumentStore.getState();
  const existing = store.tabs.find((tab) => tab.filePath === path);
  if (existing) {
    store.activateTab(existing.id);
    return;
  }
  try {
    const file = await ipc.openFile(path);
    useDocumentStore.getState().openFileTab(path, file);
  } catch (error) {
    // 비UTF-8·혼합 EOL·바이너리 거부(M1)도 이 경로로 안내된다 — 파일은 건드리지 않았다.
    notifyIpcError(STRINGS.openFailedTitle, error);
  }
}
