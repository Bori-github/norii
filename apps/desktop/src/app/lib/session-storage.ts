import {
  getTabCursor,
  getTabScroll,
  setTabCursor,
  setTabScroll,
  useDocumentStore,
} from "@entities/document";
import { useWorkspaceStore } from "@entities/workspace";
import { openFolderAtPath } from "@features/open-folder";
import { SESSION_RESTORE_TIMEOUT_MS, SESSION_SAVE_DEBOUNCE_MS } from "@shared/config";
import { ipc } from "@shared/ipc";
import type { Session } from "@shared/ipc";
import { logger } from "@shared/lib";

/**
 * 마지막 세션을 파일에 남기고 다시 세운다. 정책은
 * .claude/docs/document-model.md#세션-복원이 소유한다.
 * 읽기·쓰기 실패는 삼킨다 — 세션 하나 때문에 기동이나 종료를 막지 않는다.
 */

async function restoreSession(): Promise<void> {
  let session: Session | null;
  try {
    session = await ipc.loadSession();
  } catch {
    logger.warn("지난 세션을 읽지 못했습니다 — 빈 화면으로 시작합니다");
    return;
  }
  if (!session) {
    return;
  }

  // 본문 읽기는 서로 독립이라 함께 나간다 — 창이 보이기 전이므로 직렬로 읽으면 그만큼 늦다.
  // 탭은 응답 순서가 아니라 저장된 순서로 세운다.
  const [contents] = await Promise.all([
    Promise.allSettled(session.tabs.map((tab) => ipc.openFile(tab.path))),
    session.rootDir === null ? Promise.resolve() : openFolderAtPath(session.rootDir),
  ]);

  const store = useDocumentStore.getState();
  let activeTabId: string | null = null;
  contents.forEach((content, index) => {
    const tab = session.tabs[index];
    if (content.status === "rejected" || tab === undefined) {
      // 파일은 있으나 읽지 못했다(바이너리·권한). 그 탭만 빠지고 나머지는 선다.
      logger.warn(`세션 복원: 탭을 열지 못했습니다 — ${tab?.path ?? ""}`);
      return;
    }
    const tabId = store.openFileTab(content.value, false);
    setTabScroll(tabId, { line: tab.scrollLine, fraction: 0 });
    setTabCursor(tabId, { line: tab.cursorLine, column: tab.cursorColumn });
    if (session.active === index) {
      activeTabId = tabId;
    }
  });
  if (activeTabId !== null) {
    store.activateTab(activeTabId);
  }
}

/** 지난 세션을 세우되 상한 안에 돌아온다(→ design/window-chrome.md#부팅-순서--창은-언제-보이는가). */
export async function restoreSessionWithin(timeoutMs = SESSION_RESTORE_TIMEOUT_MS): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    restoreSession(),
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, timeoutMs);
    }),
  ]);
  clearTimeout(timer);
}

function snapshot(): Session {
  const { tabs, activeTabId } = useDocumentStore.getState();
  const { rootDir } = useWorkspaceStore.getState();
  const saved = tabs.filter((tab) => tab.filePath !== null);
  const active = saved.findIndex((tab) => tab.id === activeTabId);
  return {
    rootDir,
    tabs: saved.map((tab) => {
      // 자리는 스토어 밖에 산다(→ entities/document의 탭별 뷰 위치). 없으면 문서 처음이다.
      const cursor = getTabCursor(tab.id);
      return {
        path: tab.filePath ?? "",
        cursorLine: cursor?.line ?? 1,
        cursorColumn: cursor?.column ?? 1,
        scrollLine: getTabScroll(tab.id)?.line ?? 1,
      };
    }),
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
