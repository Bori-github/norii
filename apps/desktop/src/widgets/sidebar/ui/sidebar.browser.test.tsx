import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// IPC는 모킹한다 — 대상은 실제 파일시스템이 아니라 "트리 표시·클릭 연결"이다
// (read_dir·다이얼로그의 실제 동작은 Rust 테스트 소관 → testing.md#레이어별).
const { readDir, openFile, showOpenFolderDialog } = vi.hoisted(() => ({
  readDir: vi.fn(),
  openFile: vi.fn(),
  showOpenFolderDialog: vi.fn(),
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
    ipc: { readDir, openFile, showOpenFolderDialog },
  };
});
vi.mock("@tauri-apps/plugin-log", () => ({
  error: vi.fn(async () => {}),
  warn: vi.fn(async () => {}),
  info: vi.fn(async () => {}),
}));

import { resetTabTextRegistry, useDocumentStore } from "@entities/document";
import { useWorkspaceStore } from "@entities/workspace";
import type { FileContent, TreeNode } from "@shared/ipc";

import { Sidebar } from "../index";

const NOTES_DIR: TreeNode = {
  path: "/vault/notes",
  name: "notes",
  kind: "dir",
  isSymlink: false,
};
const README_FILE: TreeNode = {
  path: "/vault/readme.md",
  name: "readme.md",
  kind: "file",
  isSymlink: false,
};
const LINKED_FILE: TreeNode = {
  path: "/vault/linked.md",
  name: "linked.md",
  kind: "file",
  isSymlink: true,
};

function fileContent(path: string): FileContent {
  return {
    path,
    text: "# 본문\n",
    encoding: "utf-8",
    hasBom: false,
    eol: "lf",
    eolMixed: false,
    mtime: 1_000,
    hash: "hash-1",
  };
}

beforeEach(() => {
  useWorkspaceStore.setState({ rootDir: null, fileTree: [], expandedDirs: [] });
  useDocumentStore.setState({ tabs: [], activeTabId: null });
  resetTabTextRegistry();
  readDir.mockReset();
  openFile.mockReset();
  showOpenFolderDialog.mockReset();
});

afterEach(() => {
  cleanup();
});

// 집행: document-model.md#파일-트리-사이드바 — "루트 폴더를 열면 트리 표시"·"파일 클릭 →
//       탭으로 연다"·"폴더 펼치기(레벨별 lazy)"·"심볼릭 링크 배지".
// 왜: 사이드바는 파일 트리의 사용자 접점이다 — 스토어·feature가 각자 옳아도 클릭 연결이 끊기면
//     기능이 없는 것과 같다. 실제 WebKit 렌더에서 위젯→feature→스토어 배선을 검증한다.
// 보장: 빈 상태에서 폴더 열기 → 트리 표시, 폴더 클릭 → 한 단계 lazy 읽기 + 펼침,
//       파일 클릭 → 탭 열림 + 활성 표시, 심링크 배지 노출.
// 경계: 시각(유리·간격·들여쓰기 픽셀)은 수동 확인 소관. 실제 다이얼로그·파일시스템은
//       Rust·E2E 소관.
describe("Sidebar", () => {
  it("빈 상태에서 폴더를 열면 루트 한 단계가 트리로 뜬다", async () => {
    showOpenFolderDialog.mockResolvedValueOnce("/vault");
    readDir.mockResolvedValueOnce([NOTES_DIR, README_FILE]);
    const { getByTestId, getAllByTestId } = render(<Sidebar />);

    fireEvent.click(getByTestId("open-folder"));

    await waitFor(() => {
      expect(getAllByTestId("tree-dir").map((el) => el.textContent)).toEqual(["notes"]);
      expect(getAllByTestId("tree-file").map((el) => el.textContent)).toEqual(["readme.md"]);
    });
  });

  it("폴더 클릭은 그 폴더 한 단계만 읽어 펼친다 (lazy)", async () => {
    useWorkspaceStore.getState().openRoot("/vault", [NOTES_DIR]);
    readDir.mockResolvedValueOnce([
      { path: "/vault/notes/inner.md", name: "inner.md", kind: "file", isSymlink: false },
    ]);
    const { getByTestId } = render(<Sidebar />);

    fireEvent.click(getByTestId("tree-dir"));

    await waitFor(() => {
      expect(readDir).toHaveBeenCalledExactlyOnceWith("/vault/notes");
      expect(getByTestId("tree-dir").getAttribute("aria-expanded")).toBe("true");
      expect(getByTestId("tree-file").textContent).toBe("inner.md");
    });
  });

  it("파일 클릭은 탭으로 열고 활성 표시가 붙는다", async () => {
    useWorkspaceStore.getState().openRoot("/vault", [README_FILE]);
    openFile.mockResolvedValueOnce(fileContent("/vault/readme.md"));
    const { getByTestId } = render(<Sidebar />);

    fireEvent.click(getByTestId("tree-file"));

    await waitFor(() => {
      const tabs = useDocumentStore.getState().tabs;
      expect(tabs.map((tab) => tab.filePath)).toEqual(["/vault/readme.md"]);
      expect(getByTestId("tree-file").getAttribute("aria-current")).toBe("true");
    });
  });

  it("심볼릭 링크 항목에는 배지가 붙는다", () => {
    useWorkspaceStore.getState().openRoot("/vault", [LINKED_FILE, README_FILE]);
    const { getAllByLabelText } = render(<Sidebar />);

    expect(getAllByLabelText("심볼릭 링크")).toHaveLength(1);
  });
});
