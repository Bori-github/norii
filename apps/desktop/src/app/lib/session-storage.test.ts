import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { saveSession, loadSession, openFile, readDir, watchTree } = vi.hoisted(() => ({
  saveSession: vi.fn(async () => null),
  loadSession: vi.fn(async () => null as Session | null),
  openFile: vi.fn(async (path: string) => fileContent(path)),
  readDir: vi.fn(async () => []),
  watchTree: vi.fn(async () => null),
}));
vi.mock("@shared/ipc", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@shared/ipc")>()),
  ipc: { saveSession, loadSession, openFile, readDir, watchTree },
}));
vi.mock("@tauri-apps/plugin-log", () => ({
  error: vi.fn(async () => {}),
  warn: vi.fn(async () => {}),
  info: vi.fn(async () => {}),
}));

import {
  getTabCursor,
  getTabScroll,
  resetTabViewStates,
  setTabCursor,
  setTabScroll,
  useDocumentStore,
} from "@entities/document";
import type { Tab } from "@entities/document";
import { useWorkspaceStore } from "@entities/workspace";
import { SESSION_RESTORE_TIMEOUT_MS, SESSION_SAVE_DEBOUNCE_MS } from "@shared/config";
import type { FileContent, Session } from "@shared/ipc";

import { flushSession, persistSessionOnChange, restoreSessionWithin } from "./session-storage";

// 왜: 껐다 켜면 열려 있던 탭이 사라진다. 남기는 값의 일부(탭별 자리)는 스토어 밖에 있어
//     스토어 구독만으로는 최신이 아니고, 되살릴 때는 저장된 순서·활성 탭이 그대로여야 한다.
// 보장: 저장 대상은 경로가 있는 탭뿐이고 활성 탭은 그 목록 기준으로 가리킨다. 복원은 순서를
//       지키고, 열지 못한 탭이 있어도 활성 탭이 엉뚱한 문서로 옮겨가지 않는다.
// 경계: 사라진 파일을 걸러내고 경로를 허용하는 것은 Rust가 한다(→ rust-commands.md#세션).
//       복원이 창을 보이는 순서의 어디에 오는지는 부팅 순서가 소유한다
//       (→ .claude/docs/design/window-chrome.md#부팅-순서--창은-언제-보이는가).

function fileContent(path: string): FileContent {
  return {
    path,
    text: "본문",
    encoding: "utf-8",
    hasBom: false,
    eol: "lf",
    eolMixed: false,
    hash: "h",
    mtime: 0,
  };
}

function tab(id: string, filePath: string | null): Tab {
  return {
    id,
    filePath,
    title: id,
    isDirty: false,
    sourceEncoding: "utf-8",
    hasBom: false,
    eol: "lf",
    eolMixed: false,
    normalizationApproved: false,
    lastSavedHash: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  loadSession.mockResolvedValue(null);
  openFile.mockImplementation(async (path: string) => fileContent(path));
  useDocumentStore.setState({ tabs: [], activeTabId: null });
  useWorkspaceStore.setState({ rootDir: null, fileTree: [], expandedDirs: [] });
  resetTabViewStates();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("persistSessionOnChange", () => {
  it("경로 있는 탭만 담고, 활성 탭은 그 목록에서 가리킨다", async () => {
    vi.useFakeTimers();
    const stop = persistSessionOnChange();

    useDocumentStore.setState({
      tabs: [tab("t1", null), tab("t2", "/vault/a.md")],
      activeTabId: "t2",
    });
    useWorkspaceStore.setState({ rootDir: "/vault" });
    await vi.advanceTimersByTimeAsync(SESSION_SAVE_DEBOUNCE_MS);

    expect(saveSession).toHaveBeenCalledTimes(1);
    expect(saveSession).toHaveBeenCalledWith({
      rootDir: "/vault",
      tabs: [{ path: "/vault/a.md", cursorLine: 1, cursorColumn: 1, scrollLine: 1 }],
      active: 0,
    });
    stop();
  });

  it("탭별 자리를 함께 담는다", async () => {
    vi.useFakeTimers();
    const stop = persistSessionOnChange();

    useDocumentStore.setState({ tabs: [tab("t1", "/vault/a.md")], activeTabId: "t1" });
    setTabScroll("t1", { line: 42, fraction: 0.5 });
    setTabCursor("t1", { line: 45, column: 9 });
    await vi.advanceTimersByTimeAsync(SESSION_SAVE_DEBOUNCE_MS);

    expect(saveSession).toHaveBeenCalledWith(
      expect.objectContaining({
        tabs: [{ path: "/vault/a.md", cursorLine: 45, cursorColumn: 9, scrollLine: 42 }],
      }),
    );
    stop();
  });

  it("타이핑 중에는 쓰지 않는다 — 열린 문서가 그대로면 자리만 달라져도 넘어간다", async () => {
    vi.useFakeTimers();
    const stop = persistSessionOnChange();

    useDocumentStore.setState({ tabs: [tab("t1", "/vault/a.md")], activeTabId: "t1" });
    await vi.advanceTimersByTimeAsync(SESSION_SAVE_DEBOUNCE_MS);
    expect(saveSession).toHaveBeenCalledTimes(1);

    // 타이핑하는 동안 실제로 일어나는 일: 커서·스크롤이 계속 바뀌고, 자동 저장이 성공하면
    // setLastSavedHash가 tabs를 새 배열로 만들어 스토어 구독자가 호출된다.
    setTabCursor("t1", { line: 40, column: 3 });
    setTabScroll("t1", { line: 38, fraction: 0 });
    useDocumentStore.setState({ tabs: [{ ...tab("t1", "/vault/a.md"), lastSavedHash: "h2" }] });
    await vi.advanceTimersByTimeAsync(SESSION_SAVE_DEBOUNCE_MS);

    expect(saveSession).toHaveBeenCalledTimes(1);
    stop();
  });

  it("같은 상태로는 다시 쓰지 않는다", async () => {
    vi.useFakeTimers();
    const stop = persistSessionOnChange();

    useDocumentStore.setState({ tabs: [tab("t1", "/vault/a.md")], activeTabId: "t1" });
    await vi.advanceTimersByTimeAsync(SESSION_SAVE_DEBOUNCE_MS);
    // 타이핑은 탭 배열을 새로 만들지만 세션 내용은 그대로다.
    useDocumentStore.setState({ tabs: [{ ...tab("t1", "/vault/a.md"), isDirty: true }] });
    await vi.advanceTimersByTimeAsync(SESSION_SAVE_DEBOUNCE_MS);

    expect(saveSession).toHaveBeenCalledTimes(1);
    stop();
  });

  it("구독을 끊으면 더 이상 쓰지 않는다", async () => {
    vi.useFakeTimers();
    const stop = persistSessionOnChange();
    stop();

    useDocumentStore.setState({ tabs: [tab("t1", "/vault/a.md")], activeTabId: "t1" });
    await vi.advanceTimersByTimeAsync(SESSION_SAVE_DEBOUNCE_MS);

    expect(saveSession).not.toHaveBeenCalled();
  });
});

describe("restoreSessionWithin", () => {
  it("탭을 저장된 순서로 세우고, 활성 탭과 자리를 되돌린다", async () => {
    loadSession.mockResolvedValue({
      rootDir: "/vault",
      tabs: [
        { path: "/vault/a.md", cursorLine: 1, cursorColumn: 1, scrollLine: 1 },
        { path: "/vault/b.md", cursorLine: 90, cursorColumn: 4, scrollLine: 88 },
      ],
      active: 1,
    });

    await restoreSessionWithin();

    const { tabs, activeTabId } = useDocumentStore.getState();
    expect(tabs.map((t) => t.filePath)).toEqual(["/vault/a.md", "/vault/b.md"]);
    expect(tabs.find((t) => t.id === activeTabId)?.filePath).toBe("/vault/b.md");
    expect(getTabScroll(tabs[1]?.id ?? "")).toEqual({ line: 88, fraction: 0 });
    expect(getTabCursor(tabs[1]?.id ?? "")).toEqual({ line: 90, column: 4 });
    expect(useWorkspaceStore.getState().rootDir).toBe("/vault");
  });

  it("열지 못한 탭은 건너뛰고 활성 탭은 그대로 그 문서를 가리킨다", async () => {
    openFile.mockImplementation(async (path: string) => {
      if (path === "/vault/깨진.md") {
        throw new Error("열 수 없습니다");
      }
      return fileContent(path);
    });
    loadSession.mockResolvedValue({
      rootDir: null,
      tabs: [
        { path: "/vault/깨진.md", cursorLine: 1, cursorColumn: 1, scrollLine: 1 },
        { path: "/vault/b.md", cursorLine: 1, cursorColumn: 1, scrollLine: 1 },
      ],
      active: 1,
    });

    await restoreSessionWithin();

    const { tabs, activeTabId } = useDocumentStore.getState();
    expect(tabs).toHaveLength(1);
    expect(tabs.find((t) => t.id === activeTabId)?.filePath).toBe("/vault/b.md");
  });

  it("저장된 활성 탭을 열지 못하면 남은 첫 탭을 활성으로 만든다", async () => {
    openFile.mockImplementation(async (path: string) => {
      if (path === "/vault/깨진.md") {
        throw new Error("열 수 없습니다");
      }
      return fileContent(path);
    });
    loadSession.mockResolvedValue({
      rootDir: null,
      tabs: [
        { path: "/vault/a.md", cursorLine: 1, cursorColumn: 1, scrollLine: 1 },
        { path: "/vault/깨진.md", cursorLine: 1, cursorColumn: 1, scrollLine: 1 },
      ],
      active: 1,
    });

    await restoreSessionWithin();

    const { tabs, activeTabId } = useDocumentStore.getState();
    expect(tabs.find((t) => t.id === activeTabId)?.filePath).toBe("/vault/a.md");
  });

  it("상한을 넘기면 뒤늦게 도착한 탭을 세우지 않는다", async () => {
    vi.useFakeTimers();
    let release: (() => void) | undefined;
    openFile.mockImplementation(
      async () =>
        new Promise((resolve) => {
          release = () => resolve(fileContent("/vault/느린.md"));
        }),
    );
    loadSession.mockResolvedValue({
      rootDir: null,
      tabs: [{ path: "/vault/느린.md", cursorLine: 1, cursorColumn: 1, scrollLine: 1 }],
      active: 0,
    });

    const pending = restoreSessionWithin();
    await vi.advanceTimersByTimeAsync(SESSION_RESTORE_TIMEOUT_MS);
    await pending;
    release?.();
    await vi.advanceTimersByTimeAsync(0);

    // 창은 이미 보인다 — 지금 탭을 세우면 사용자가 보는 화면이 뒤늦게 바뀐다.
    expect(useDocumentStore.getState().tabs).toHaveLength(0);
  });

  it("지난 세션이 없으면 아무 탭도 세우지 않는다", async () => {
    await restoreSessionWithin();

    expect(useDocumentStore.getState().tabs).toHaveLength(0);
    expect(openFile).not.toHaveBeenCalled();
  });

  it("읽기가 끝나지 않아도 상한에서 돌아온다 — 창을 못 보이는 것이 더 나쁘다", async () => {
    vi.useFakeTimers();
    loadSession.mockReturnValueOnce(new Promise(() => {}));

    const pending = restoreSessionWithin();
    await vi.advanceTimersByTimeAsync(SESSION_RESTORE_TIMEOUT_MS);

    await expect(pending).resolves.toBeUndefined();
  });
});

describe("flushSession", () => {
  it("구독이 잡지 못하는 자리까지 쓴다 — 스크롤은 스토어를 거치지 않는다", async () => {
    const stop = persistSessionOnChange();
    useDocumentStore.setState({ tabs: [tab("t1", "/vault/a.md")], activeTabId: "t1" });
    setTabScroll("t1", { line: 7, fraction: 0 });

    await flushSession();

    expect(saveSession).toHaveBeenCalledWith(
      expect.objectContaining({
        tabs: [{ path: "/vault/a.md", cursorLine: 1, cursorColumn: 1, scrollLine: 7 }],
      }),
    );
    stop();
  });

  it("쓰기가 실패해도 종료를 막지 않는다", async () => {
    const stop = persistSessionOnChange();
    useDocumentStore.setState({ tabs: [tab("t1", "/vault/a.md")], activeTabId: "t1" });
    saveSession.mockRejectedValueOnce(new Error("디스크 없음"));

    await expect(flushSession()).resolves.toBeUndefined();

    // 실패 경로에 실제로 닿았음을 고정한다 — 비교에서 걸러졌으면 통과가 무의미하다.
    expect(saveSession).toHaveBeenCalledTimes(1);
    stop();
  });
});
