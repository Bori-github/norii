import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// IPC는 모킹한다 — 대상은 실제 파일·다이얼로그가 아니라 "버튼이 어느 길로 연결되는가"다
// (다이얼로그·열기의 실제 동작은 Rust 테스트·E2E 소관 → testing.md#레이어별).
const { openFile, showOpenDialog, showOpenFolderDialog, readDir } = vi.hoisted(() => ({
  openFile: vi.fn(),
  showOpenDialog: vi.fn(),
  showOpenFolderDialog: vi.fn(),
  readDir: vi.fn(),
}));

vi.mock("@shared/ipc", () => {
  class IpcError extends Error {
    readonly kind: string;
    constructor(kind: string, message: string) {
      super(message);
      this.name = "IpcError";
      this.kind = kind;
    }
  }
  return {
    IpcError,
    isIpcError: (value: unknown) => value instanceof IpcError,
    ipc: { openFile, showOpenDialog, showOpenFolderDialog, readDir, watchTree: vi.fn() },
  };
});
vi.mock("@tauri-apps/plugin-log", () => ({
  error: vi.fn(async () => {}),
  warn: vi.fn(async () => {}),
  info: vi.fn(async () => {}),
}));

import { resetTabTextRegistry, useDocumentStore } from "@entities/document";
import { useWorkspaceStore } from "@entities/workspace";
import type { FileContent } from "@shared/ipc";

import { EmptyState } from "./empty-state";

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

beforeEach(() => {
  vi.clearAllMocks();
  useDocumentStore.setState({ tabs: [], activeTabId: null });
  useWorkspaceStore.setState({ rootDir: null, fileTree: [], expandedDirs: [], recentFiles: [] });
  resetTabTextRegistry();
});

afterEach(() => {
  cleanup();
});

// 집행: document-model.md#빈-탭--탭바는-비지-않는다 — 버튼(폴더 열기가 첫 자리)과
//       최근 파일 목록.
// 왜: 폴더 없이 앱을 켜면 이 화면이 뜬다 — 버튼이 동작하지 않으면 새 문서·파일 열기는
//     단축키로만 가능하다.
// 보장: 버튼의 존재와 순서, 각 버튼이 규정된 길(다이얼로그·Untitled)로 연결됨.
// 경계: 다이얼로그 이후의 열기·트리 표시는 open-file·open-folder feature 테스트 소관.
describe("빈 상태 버튼", () => {
  it("폴더 열기 · 파일 열기 · 새 문서 순서로 표시한다", () => {
    const { getByTestId } = render(<EmptyState />);
    const buttons = [...getByTestId("empty-state").querySelectorAll("button")];
    expect(buttons.map((button) => button.dataset.testid)).toEqual([
      "empty-open-folder",
      "empty-open-file",
      "empty-new-doc",
    ]);
  });

  it("새 문서 버튼은 Cmd+N과 같은 길이다 — 경로 없는 Untitled 탭", () => {
    const { getByTestId } = render(<EmptyState />);
    fireEvent.click(getByTestId("empty-new-doc"));

    const { tabs, activeTabId } = useDocumentStore.getState();
    expect(tabs).toHaveLength(1);
    expect(tabs[0]).toMatchObject({ filePath: null, title: "Untitled" });
    expect(activeTabId).toBe(tabs[0]?.id);
  });

  it("파일 열기·폴더 열기 버튼은 다이얼로그를 연다", async () => {
    showOpenDialog.mockResolvedValue(null);
    showOpenFolderDialog.mockResolvedValue(null);
    const { getByTestId } = render(<EmptyState />);

    fireEvent.click(getByTestId("empty-open-file"));
    fireEvent.click(getByTestId("empty-open-folder"));

    await waitFor(() => {
      expect(showOpenDialog).toHaveBeenCalledTimes(1);
      expect(showOpenFolderDialog).toHaveBeenCalledTimes(1);
    });
  });
});

// 집행: document-model.md#빈-탭--탭바는-비지-않는다 — "recentFiles를 파일명으로 표시하고,
//       누르면 그 파일을 연다. 목록이 비면 표시하지 않는다".
// 왜: 최근 파일을 표시하는 곳은 이 화면뿐이다 — 표시가 없으면 저장·복원(세션)만 있고
//     쓰는 곳이 없다.
// 보장: 목록의 파일명 표시(전체 경로는 title), 클릭 → 그 파일이 탭으로 열림, 빈 목록은 미표시.
// 경계: 목록의 순서·상한은 workspace-store 테스트, 없는 경로의 필터링은 Rust 소관.
describe("최근 파일 목록", () => {
  it("파일명으로 표시하고 누르면 그 파일을 연다", async () => {
    useWorkspaceStore.setState({ recentFiles: ["/vault/notes/회고.md", "/vault/할일.md"] });
    openFile.mockResolvedValue(fileContent("/vault/notes/회고.md"));
    const { getByTestId, getByTitle } = render(<EmptyState />);

    const items = [...getByTestId("recent-files").querySelectorAll("button")];
    expect(items.map((item) => item.textContent)).toEqual(["회고.md", "할일.md"]);
    expect(getByTitle("/vault/notes/회고.md")).toBeTruthy();

    fireEvent.click(items[0] as HTMLButtonElement);
    await waitFor(() => {
      expect(useDocumentStore.getState().tabs[0]?.filePath).toBe("/vault/notes/회고.md");
    });
  });

  it("목록이 비면 표시하지 않는다", () => {
    const { queryByTestId } = render(<EmptyState />);
    expect(queryByTestId("recent-files")).toBeNull();
  });
});
