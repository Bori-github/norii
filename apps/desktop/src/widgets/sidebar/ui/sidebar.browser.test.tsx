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

import { resetTreeNav } from "../model/tree-nav-store";
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
  resetTreeNav();
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
      expect(getByTestId("tree-file").getAttribute("aria-selected")).toBe("true");
    });
  });

  it("심볼릭 링크 항목에는 배지가 붙는다", () => {
    useWorkspaceStore.getState().openRoot("/vault", [LINKED_FILE, README_FILE]);
    const { getAllByLabelText } = render(<Sidebar />);

    expect(getAllByLabelText("심볼릭 링크")).toHaveLength(1);
  });

  it("폴더 안의 파일을 클릭해도 폴더는 접히지 않는다", async () => {
    // 파일 li는 폴더 li의 자손이라, 클릭이 부모로 버블하면 폴더가 토글되어 접힌다.
    // 클릭은 자기 항목에서 멈춰야 한다(stopPropagation).
    const innerFile: TreeNode = {
      path: "/vault/notes/inner.md",
      name: "inner.md",
      kind: "file",
      isSymlink: false,
    };
    useWorkspaceStore.setState({
      rootDir: "/vault",
      fileTree: [{ ...NOTES_DIR, children: [innerFile] }],
      expandedDirs: ["/vault/notes"],
    });
    openFile.mockResolvedValueOnce(fileContent("/vault/notes/inner.md"));
    const { getByTestId } = render(<Sidebar />);

    fireEvent.click(getByTestId("tree-file"));

    await waitFor(() => {
      expect(useDocumentStore.getState().tabs.map((tab) => tab.filePath)).toEqual([
        "/vault/notes/inner.md",
      ]);
    });
    // 파일은 열렸고, 폴더는 그대로 펼쳐져 있어야 한다.
    expect(useWorkspaceStore.getState().expandedDirs).toContain("/vault/notes");
  });
});

// 집행: document-model.md#파일-트리-사이드바 — ARIA 트리 시맨틱·키보드 탐색·빈 폴더 표시.
// 왜: "반쪽 ARIA는 없느니만 못하다"(작업 규칙) — 롤만 붙이고 키보드가 없으면 포인터 없이
//     못 쓰고, 정지점이 여럿이면 Tab이 헷갈린다. 시맨틱과 키보드를 한 세트로 검증한다.
// 보장: role=tree/treeitem/group·aria-level·정지점 하나(roving)·↑↓·→(펼침)·Enter(열기),
//       펼친 빈 폴더의 "비어 있음".
// 경계: 시각(들여쓰기·링)은 수동. 화살표 세부(←접힘·Home/End)는 같은 DOM-순서 로직이라
//       대표 경로(↑↓·→·Enter)로 대신한다.
describe("Sidebar 접근성·키보드", () => {
  it("ARIA 트리 시맨틱을 갖춘다", async () => {
    useWorkspaceStore.getState().openRoot("/vault", [NOTES_DIR, README_FILE]);
    const { getByTestId } = render(<Sidebar />);

    await waitFor(() => {
      expect(getByTestId("file-tree").getAttribute("role")).toBe("tree");
      const dir = getByTestId("tree-dir");
      expect(dir.getAttribute("role")).toBe("treeitem");
      expect(dir.getAttribute("aria-level")).toBe("1");
      expect(dir.getAttribute("aria-expanded")).toBe("false");
    });
  });

  it("Tab 정지점은 항상 하나뿐이다 (roving tabindex)", async () => {
    useWorkspaceStore.getState().openRoot("/vault", [NOTES_DIR, README_FILE]);
    const { container } = render(<Sidebar />);

    await waitFor(() => {
      const stops = [...container.querySelectorAll<HTMLElement>('[role="treeitem"]')].filter(
        (el) => el.tabIndex === 0,
      );
      expect(stops).toHaveLength(1);
    });
  });

  it("↑↓로 보이는 노드 사이를 오간다", async () => {
    useWorkspaceStore.getState().openRoot("/vault", [NOTES_DIR, README_FILE]);
    const { getByTestId } = render(<Sidebar />);

    await waitFor(() => expect(getByTestId("tree-dir").tabIndex).toBe(0));
    const dir = getByTestId("tree-dir");
    dir.focus();

    fireEvent.keyDown(dir, { key: "ArrowDown" });
    await waitFor(() => expect(document.activeElement).toBe(getByTestId("tree-file")));

    fireEvent.keyDown(getByTestId("tree-file"), { key: "ArrowUp" });
    await waitFor(() => expect(document.activeElement).toBe(getByTestId("tree-dir")));
  });

  it("→는 접힌 폴더를 펼친다", async () => {
    useWorkspaceStore.getState().openRoot("/vault", [NOTES_DIR]);
    readDir.mockResolvedValueOnce([
      { path: "/vault/notes/x.md", name: "x.md", kind: "file", isSymlink: false },
    ]);
    const { getByTestId } = render(<Sidebar />);
    const dir = getByTestId("tree-dir");
    dir.focus();

    fireEvent.keyDown(dir, { key: "ArrowRight" });

    await waitFor(() => {
      expect(readDir).toHaveBeenCalledExactlyOnceWith("/vault/notes");
      expect(getByTestId("tree-dir").getAttribute("aria-expanded")).toBe("true");
    });
  });

  it("Enter로 파일을 연다", async () => {
    useWorkspaceStore.getState().openRoot("/vault", [README_FILE]);
    openFile.mockResolvedValueOnce(fileContent("/vault/readme.md"));
    const { getByTestId } = render(<Sidebar />);
    const file = getByTestId("tree-file");
    file.focus();

    fireEvent.keyDown(file, { key: "Enter" });

    await waitFor(() => {
      expect(useDocumentStore.getState().tabs.map((tab) => tab.filePath)).toEqual([
        "/vault/readme.md",
      ]);
    });
  });

  it("항목을 클릭하면 그 항목이 포커스를 받는다 (WebKit 클릭 포커스 보정)", async () => {
    // WebKit은 tabindex만 있는 li를 클릭해도 포커스를 주지 않는다 — 클릭 뒤 방향키가
    // 트리에 닿게 하려면 명시적으로 포커스해야 한다. 없으면 키보드 탐색이 클릭으로 시작되지 않는다.
    useWorkspaceStore.getState().openRoot("/vault", [NOTES_DIR]);
    const { getByTestId } = render(<Sidebar />);

    fireEvent.click(getByTestId("tree-dir"));

    await waitFor(() => expect(document.activeElement).toBe(getByTestId("tree-dir")));
  });

  it("펼친 빈 폴더는 '비어 있음'을 보인다", async () => {
    useWorkspaceStore.getState().openRoot("/vault", [NOTES_DIR]);
    readDir.mockResolvedValueOnce([]);
    const { getByTestId } = render(<Sidebar />);

    fireEvent.click(getByTestId("tree-dir"));

    await waitFor(() => {
      expect(getByTestId("tree-empty").textContent).toBe("비어 있음");
    });
  });
});
