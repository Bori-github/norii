import { findTab, getTabText, setTabText, useDocumentStore } from "@entities/document";
import { STRINGS } from "@shared/config";
import { ipc, isIpcError } from "@shared/ipc";
import { notifyIpcError, useConfirmStore } from "@shared/ui";

import { AUTOSAVE_DELAY_MS } from "../config";
import { createAutosaveScheduler } from "./autosave-scheduler";
import { isTabInConflict, useConflictStore } from "./conflict-store";
import { createSaveQueue } from "./save-queue";

// 저장 오케스트레이션 — 정책의 단일 출처: file-lifecycle.md(자동 저장·충돌·탭 닫기 규칙).
// 같은 탭의 저장은 큐로 직렬화한다(뒤 저장이 앞 저장의 새 해시를 본 뒤 나가야 가짜 충돌이 없다).

export type SaveOutcome = "saved" | "cancelled" | "conflict" | "error" | "skipped";

const saveQueue = createSaveQueue();

const autosave = createAutosaveScheduler({
  delayMs: AUTOSAVE_DELAY_MS,
  flush: (tabId) => {
    void autosaveFlush(tabId);
  },
});

/** 에디터가 문서 변경을 알린다 — 자동 저장 예약. Untitled는 대상이 아니다(경로 없음). */
export function noteDocumentChanged(tabId: string): void {
  const tab = findTab(tabId);
  if (!tab || tab.filePath === null) {
    return;
  }
  autosave.noteChange(tabId);
}

async function autosaveFlush(tabId: string): Promise<void> {
  const tab = findTab(tabId);
  // 충돌 중 일시 중지는 스케줄러가 보장하지만, 예약과 해소가 겹칠 수 있어 여기서도 거른다.
  if (!tab || tab.filePath === null || !tab.isDirty || isTabInConflict(tabId)) {
    return;
  }
  await saveTabNow(tabId);
}

/** 즉시 저장(Cmd+S·자동 저장 플러시). Untitled는 다이얼로그로 경로를 확정한다. */
export function saveTabNow(tabId: string): Promise<SaveOutcome> {
  return saveQueue.enqueue(tabId, () => performSave(tabId, { forceDialog: false }));
}

/** 다른 이름으로 저장(Cmd+Shift+S) — 항상 다이얼로그를 띄운다. */
export function saveTabAs(tabId: string): Promise<SaveOutcome> {
  return saveQueue.enqueue(tabId, () => performSave(tabId, { forceDialog: true }));
}

async function performSave(
  tabId: string,
  { forceDialog }: { forceDialog: boolean },
): Promise<SaveOutcome> {
  const tab = findTab(tabId);
  if (!tab) {
    return "skipped";
  }
  const text = getTabText(tabId);
  if (text === null) {
    return "skipped";
  }
  // 이 저장이 대기 중인 자동 저장을 대신한다 — 이중 저장을 막는다.
  autosave.discard(tabId);

  let path = tab.filePath;
  let expectedHash = tab.lastSavedHash;
  if (forceDialog || path === null) {
    let picked: string | null;
    try {
      picked = await ipc.showSaveDialog(
        path === null ? STRINGS.untitledDefaultFileName : tab.title,
      );
    } catch (error) {
      notifyIpcError(STRINGS.saveFailedTitle, error);
      return "error";
    }
    if (picked === null) {
      return "cancelled";
    }
    path = picked;
    // 새 경로 또는 명시적 덮어쓰기 — OS 다이얼로그가 이미 덮어쓰기를 확인했다(→ rust-commands.md).
    expectedHash = null;
  }

  try {
    const result = await ipc.saveFile({
      path,
      text,
      eol: tab.eol,
      hasBom: tab.hasBom,
      expectedHash,
    });
    const store = useDocumentStore.getState();
    if (tab.filePath !== path) {
      store.assignPath(tabId, path);
    }
    store.setLastSavedHash(tabId, result.hash);
    // 저장이 나가는 동안 추가 편집이 있었으면 dirty를 유지한다(그 편집은 아직 미저장).
    if (getTabText(tabId) === text) {
      store.setDirty(tabId, false);
    }
    return "saved";
  } catch (error) {
    if (isIpcError(error) && error.kind === "conflict") {
      // 충돌 — 자동 저장을 멈추고 사용자의 명시적 선택을 기다린다(자동 병합 금지).
      useConflictStore.getState().markConflict(tabId);
      autosave.pause(tabId);
      return "conflict";
    }
    notifyIpcError(STRINGS.saveFailedTitle, error);
    return "error";
  }
}

/** 충돌 해소 — 내 편집으로 덮어쓰기(expectedHash=None 강제 저장). */
export async function resolveConflictKeepMine(tabId: string): Promise<void> {
  const tab = findTab(tabId);
  const text = getTabText(tabId);
  if (!tab || tab.filePath === null || text === null) {
    return;
  }
  const path = tab.filePath;
  try {
    await saveQueue.enqueue(tabId, async () => {
      const result = await ipc.saveFile({
        path,
        text,
        eol: tab.eol,
        hasBom: tab.hasBom,
        expectedHash: null,
      });
      const store = useDocumentStore.getState();
      store.setLastSavedHash(tabId, result.hash);
      if (getTabText(tabId) === text) {
        store.setDirty(tabId, false);
      }
    });
  } catch (error) {
    notifyIpcError(STRINGS.saveFailedTitle, error);
    return;
  }
  useConflictStore.getState().clearConflict(tabId);
  autosave.resume(tabId);
}

/** 충돌 해소 — 디스크 버전으로 되돌리기(리로드). 편집 버전은 버려진다. */
export async function resolveConflictKeepDisk(tabId: string): Promise<void> {
  const tab = findTab(tabId);
  if (!tab || tab.filePath === null) {
    return;
  }
  try {
    const file = await ipc.openFile(tab.filePath);
    setTabText(tabId, file.text);
    useDocumentStore.getState().updateFileMeta(tabId, file);
  } catch (error) {
    notifyIpcError(STRINGS.openFailedTitle, error);
    return;
  }
  useConflictStore.getState().clearConflict(tabId);
  // 리로드 직후는 디스크와 동일 — 남아 있던 예약을 버리고 재개한다.
  autosave.discard(tabId);
  autosave.resume(tabId);
}

/**
 * 탭 닫기 — document-model.md 다중 탭 규칙(종료 방어와 동일):
 * 경로 있는 dirty 탭은 플러시 후 닫고, Untitled dirty는 확인을 받고, 실패하면 열어 둔다.
 */
export async function requestCloseTab(tabId: string): Promise<void> {
  const tab = findTab(tabId);
  if (!tab) {
    return;
  }
  if (!tab.isDirty) {
    cleanupAndRemove(tabId);
    return;
  }
  if (tab.filePath === null) {
    // 저장할 경로가 없다 — 조용히 버리면 데이터 유실이므로 확인 다이얼로그를 띄운다
    // (→ document-model.md 다중 탭 규칙 · 인앱 모달인 이유는 file-lifecycle.md#종료-방어).
    useConfirmStore.getState().requestConfirm({
      title: STRINGS.closeDirtyUntitledTitle,
      body: STRINGS.closeDirtyUntitledBody,
      confirmLabel: STRINGS.closeDiscardLabel,
      cancelLabel: STRINGS.closeCancelLabel,
      onConfirm: () => cleanupAndRemove(tabId),
    });
    return;
  }
  const outcome = await saveTabNow(tabId);
  if (outcome === "saved" || outcome === "skipped") {
    cleanupAndRemove(tabId);
    return;
  }
  if (outcome === "error") {
    // 저장 실패 — 닫기를 강행할지 사용자가 정한다(→ document-model.md "저장 실패는 확인 다이얼로그").
    useConfirmStore.getState().requestConfirm({
      title: STRINGS.saveFailedTitle,
      body: STRINGS.closeSaveFailedBody,
      confirmLabel: STRINGS.closeDiscardLabel,
      cancelLabel: STRINGS.closeCancelLabel,
      onConfirm: () => cleanupAndRemove(tabId),
    });
  }
  // conflict — 탭을 열어 두고 충돌 배너가 선택을 안내한다.
}

function cleanupAndRemove(tabId: string): void {
  autosave.discard(tabId);
  useConflictStore.getState().clearConflict(tabId);
  useDocumentStore.getState().removeTab(tabId);
}
