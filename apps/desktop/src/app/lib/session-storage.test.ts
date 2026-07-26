import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { saveSession } = vi.hoisted(() => ({ saveSession: vi.fn(async () => null) }));
vi.mock("@shared/ipc", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@shared/ipc")>()),
  ipc: { saveSession },
}));
vi.mock("@tauri-apps/plugin-log", () => ({
  error: vi.fn(async () => {}),
  warn: vi.fn(async () => {}),
  info: vi.fn(async () => {}),
}));

import { resetTabViewStates, setTabScroll, useDocumentStore } from "@entities/document";
import type { Tab } from "@entities/document";
import { useWorkspaceStore } from "@entities/workspace";
import { SESSION_SAVE_DEBOUNCE_MS } from "@shared/config";

import { flushSession, persistSessionOnChange } from "./session-storage";

// 왜: 껐다 켜면 열려 있던 탭이 사라진다. 되살리려면 무엇이 열려 있었는지를 창을 닫기 전에
//     남겨야 하는데, 그 값의 일부(탭별 자리)는 스토어 밖에 있어 스토어 구독만으로는
//     최신 상태가 아니다.
// 보장: 저장 대상은 경로가 있는 탭뿐이고, 활성 탭은 그 목록 기준으로 가리킨다.
//       탭·루트가 바뀌면 디바운스로 한 번 쓰고, 종료 시에는 바뀐 것이 없어도 쓴다.
// 경계: 읽어서 화면을 세우는 것은 복원 배선의 몫이다. 사라진 파일을 걸러내고 경로를 허용하는
//       것은 Rust가 한다(→ .claude/docs/rust-commands.md#세션).

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
      tabs: [{ path: "/vault/a.md", scrollLine: 1 }],
      active: 0,
    });
    stop();
  });

  it("탭별 자리를 함께 담는다", async () => {
    vi.useFakeTimers();
    const stop = persistSessionOnChange();

    useDocumentStore.setState({ tabs: [tab("t1", "/vault/a.md")], activeTabId: "t1" });
    setTabScroll("t1", { line: 42, fraction: 0.5 });
    await vi.advanceTimersByTimeAsync(SESSION_SAVE_DEBOUNCE_MS);

    expect(saveSession).toHaveBeenCalledWith(
      expect.objectContaining({ tabs: [{ path: "/vault/a.md", scrollLine: 42 }] }),
    );
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

describe("flushSession", () => {
  it("바뀐 것이 없어도 쓴다 — 스크롤은 스토어를 거치지 않는다", async () => {
    const stop = persistSessionOnChange();
    useDocumentStore.setState({ tabs: [tab("t1", "/vault/a.md")], activeTabId: "t1" });
    setTabScroll("t1", { line: 7, fraction: 0 });

    await flushSession();

    expect(saveSession).toHaveBeenCalledWith(
      expect.objectContaining({ tabs: [{ path: "/vault/a.md", scrollLine: 7 }] }),
    );
    stop();
  });

  it("쓰기가 실패해도 종료를 막지 않는다", async () => {
    saveSession.mockRejectedValueOnce(new Error("디스크 없음"));
    await expect(flushSession()).resolves.toBeUndefined();
  });
});
