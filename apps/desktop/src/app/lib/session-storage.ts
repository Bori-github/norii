import { getTabScroll, useDocumentStore } from "@entities/document";
import { useWorkspaceStore } from "@entities/workspace";
import { SESSION_SAVE_DEBOUNCE_MS } from "@shared/config";
import { ipc } from "@shared/ipc";
import type { Session } from "@shared/ipc";
import { logger } from "@shared/lib";

/**
 * 마지막 세션을 파일에 남긴다. 정책은 .claude/docs/document-model.md#세션-복원이 소유한다.
 * 쓰기 실패는 삼킨다 — 세션을 못 남기는 것이 종료를 막을 이유는 아니다.
 */

function snapshot(): Session {
  const { tabs, activeTabId } = useDocumentStore.getState();
  const { rootDir } = useWorkspaceStore.getState();
  const saved = tabs.filter((tab) => tab.filePath !== null);
  const active = saved.findIndex((tab) => tab.id === activeTabId);
  return {
    rootDir,
    tabs: saved.map((tab) => ({
      path: tab.filePath ?? "",
      // 자리는 스토어 밖에 산다(→ entities/document의 탭별 뷰 위치). 없으면 맨 위다.
      scrollLine: getTabScroll(tab.id)?.line ?? 1,
    })),
    active: active === -1 ? null : active,
  };
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
// 탭 배열은 타이핑(dirty 전환)에도 새로 만들어진다 — 세션에 담는 부분만 비교한다.
let written = "";

async function save(): Promise<void> {
  const session = snapshot();
  const pending = JSON.stringify(session);
  if (pending === written) {
    return;
  }
  try {
    await ipc.saveSession(session);
    written = pending;
  } catch {
    logger.warn("세션을 저장하지 못했습니다");
  }
}

function scheduleSave(): void {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void save();
  }, SESSION_SAVE_DEBOUNCE_MS);
}

/** 탭·루트가 바뀔 때 저장한다. 반환값을 부르면 구독을 끊는다. */
export function persistSessionOnChange(): () => void {
  written = JSON.stringify(snapshot());

  const unsubscribe = [
    useDocumentStore.subscribe(scheduleSave),
    useWorkspaceStore.subscribe(scheduleSave),
  ];

  return () => {
    if (saveTimer !== null) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    for (const stop of unsubscribe) {
      stop();
    }
  };
}

/**
 * 지금 상태를 쓴다 — 창을 닫기 전에 부른다(→ file-lifecycle.md#종료-방어).
 * 대기 중인 디바운스가 없어도 쓴다: 탭별 자리는 스토어를 거치지 않아 구독이 잡지 못한다.
 */
export async function flushSession(): Promise<void> {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  await save();
}
