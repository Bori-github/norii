import { useDocumentStore } from "@entities/document";
import { STRINGS } from "@shared/config";
import { ipc, isIpcError } from "@shared/ipc";
import { notifyIpcError, useConfirmStore } from "@shared/ui";

import type { EntryKind, EntryProblem } from "./entry-name";

// 사이드바 항목 조작 — 커맨드 계약: .claude/docs/rust-commands.md#항목-조작,
// 트리 반영은 폴더 감시가 맡는다(→ document-model.md#파일-트리-사이드바).

export type EntryResult = { ok: true; path: string } | { ok: false; problem: EntryProblem };

// 이름을 고쳐 풀리는 실패는 입력칸 옆에 붙고, 나머지는 알림으로 간다.
const INLINE_PROBLEMS: Record<string, EntryProblem> = {
  alreadyExists: "duplicate",
  invalidName: "invalid",
};

function toResult(error: unknown, title: string): EntryResult {
  const problem = isIpcError(error) ? INLINE_PROBLEMS[error.kind] : undefined;
  if (problem !== undefined) {
    return { ok: false, problem };
  }
  notifyIpcError(title, error);
  return { ok: false, problem: "failed" };
}

export async function createEntryIn(
  dir: string,
  name: string,
  kind: EntryKind,
): Promise<EntryResult> {
  try {
    const path = kind === "file" ? await ipc.createFile(dir, name) : await ipc.createDir(dir, name);
    return { ok: true, path };
  } catch (error) {
    return toResult(error, STRINGS.createEntryFailedTitle);
  }
}

export async function renameEntryTo(path: string, newName: string): Promise<EntryResult> {
  try {
    const renamed = await ipc.renameEntry(path, newName);
    useDocumentStore.getState().retargetTabs(path, renamed);
    return { ok: true, path: renamed };
  } catch (error) {
    return toResult(error, STRINGS.renameEntryFailedTitle);
  }
}

export function requestDeleteEntry(path: string, name: string): void {
  useConfirmStore.getState().requestConfirm({
    title: STRINGS.deleteEntryTitle,
    body: STRINGS.deleteEntryBody(name),
    confirmLabel: STRINGS.deleteEntryConfirmLabel,
    cancelLabel: STRINGS.deleteEntryCancelLabel,
    onConfirm: () => {
      void ipc.deleteEntry(path).catch((error: unknown) => {
        notifyIpcError(STRINGS.deleteEntryFailedTitle, error);
      });
    },
  });
}
