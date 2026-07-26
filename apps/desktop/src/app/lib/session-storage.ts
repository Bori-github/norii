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
import { logger, within } from "@shared/lib";

/**
 * 마지막 세션을 파일에 남기고 다시 세운다. 정책은
 * .claude/docs/document-model.md#세션-복원이 소유한다.
 * 읽기·쓰기 실패는 삼킨다 — 세션 하나 때문에 기동이나 종료를 막지 않는다.
 */

/** 상한을 넘겨 포기한 복원 — 뒤늦게 도착한 응답으로 화면을 건드리지 않는다. */
let abandoned = false;

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
  if (abandoned) {
    // 창이 이미 보인다 — 지금 탭을 세우면 사용자가 보는 화면이 뒤늦게 바뀐다.
    return;
  }

  const store = useDocumentStore.getState();
  let activeTabId: string | null = null;
  let firstTabId: string | null = null;
  contents.forEach((content, index) => {
    const tab = session.tabs[index];
    if (content.status === "rejected" || tab === undefined) {
      // 파일은 있으나 읽지 못했거나(바이너리·권한), 응답과 탭 목록의 길이가 어긋났다.
      logger.warn(`세션 복원: 탭을 열지 못했습니다 — ${tab?.path ?? String(index)}`);
      return;
    }
    const tabId = store.openFileTab(content.value, false);
    firstTabId ??= tabId;
    setTabScroll(tabId, { line: tab.scrollLine, fraction: 0 });
    setTabCursor(tabId, { line: tab.cursorLine, column: tab.cursorColumn });
    if (session.active === index) {
      activeTabId = tabId;
    }
  });
  // 저장된 활성 탭이 걸러졌으면 첫 탭을 세운다 — 그러지 않으면 마지막에 열린 탭이 활성으로
  // 남아, 어느 문서가 뜨는지가 저장 순서에 딸려간다(→ document-model.md#세션-복원).
  const target = activeTabId ?? firstTabId;
  if (target !== null) {
    store.activateTab(target);
  }
}

/** 지난 세션을 세우되 상한 안에 돌아온다(→ design/window-chrome.md#부팅-순서--창은-언제-보이는가). */
export async function restoreSessionWithin(timeoutMs = SESSION_RESTORE_TIMEOUT_MS): Promise<void> {
  abandoned = false;
  const finished = await within(restoreSession(), timeoutMs);
  abandoned = !finished;
}

function snapshot(): Session {
  const { tabs, activeTabId } = useDocumentStore.getState();
  const { rootDir } = useWorkspaceStore.getState();
  const saved = tabs.filter(
    (tab): tab is typeof tab & { filePath: string } => tab.filePath !== null,
  );
  const active = saved.findIndex((tab) => tab.id === activeTabId);
  return {
    rootDir,
    tabs: saved.map((tab) => {
      // 자리는 스토어 밖에 산다(→ entities/document의 탭별 뷰 위치). 없으면 문서 처음이다.
      const cursor = getTabCursor(tab.id);
      return {
        path: tab.filePath,
        cursorLine: cursor?.line ?? 1,
        cursorColumn: cursor?.column ?? 1,
        scrollLine: getTabScroll(tab.id)?.line ?? 1,
      };
    }),
    active: active === -1 ? null : active,
  };
}

/**
 * 구독이 반응해야 하는 부분만 뽑는다 — 어느 문서가 어떤 순서로 열려 있는가.
 *
 * 탭별 자리(커서·스크롤)를 여기 넣으면 타이핑 내내 쓰기가 나간다: 자동 저장이 한 바퀴 돌
 * 때마다 탭 배열이 새로 만들어져 구독이 깨어나고, 그 사이 커서가 움직여 있기 때문이다.
 * 자리는 종료 시 flushSession이 담는다.
 */
function structureKey(session: Session): string {
  return JSON.stringify([session.rootDir, session.active, session.tabs.map((tab) => tab.path)]);
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let writtenStructure = "";
let written = "";

async function write(session: Session): Promise<void> {
  try {
    await ipc.saveSession(session);
    written = JSON.stringify(session);
    writtenStructure = structureKey(session);
  } catch {
    logger.warn("세션을 저장하지 못했습니다");
  }
}

/** 구독발 저장 — 열린 문서 구성이 그대로면 쓰지 않는다. */
async function saveStructure(): Promise<void> {
  const session = snapshot();
  if (structureKey(session) === writtenStructure) {
    return;
  }
  await write(session);
}

function scheduleSave(): void {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void saveStructure();
  }, SESSION_SAVE_DEBOUNCE_MS);
}

/** 탭·루트가 바뀔 때 저장한다. 반환값을 부르면 구독을 끊는다. */
export function persistSessionOnChange(): () => void {
  const session = snapshot();
  written = JSON.stringify(session);
  writtenStructure = structureKey(session);

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
 * 구독이 잡지 못하는 탭별 자리까지 담으므로, 대기 중인 디바운스가 없어도 비교해서 쓴다.
 */
export async function flushSession(): Promise<void> {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  const session = snapshot();
  if (JSON.stringify(session) === written) {
    return;
  }
  await write(session);
}
