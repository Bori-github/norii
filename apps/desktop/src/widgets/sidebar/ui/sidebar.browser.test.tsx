import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// IPC는 모킹한다 — 대상은 실제 파일시스템이 아니라 "트리 표시·클릭 연결"이다
// (read_dir·다이얼로그의 실제 동작은 Rust 테스트 소관 → testing.md#레이어별).
const { readDir, openFile, showOpenFolderDialog, createFile, createDir, renameEntry, deleteEntry } =
  vi.hoisted(() => ({
    readDir: vi.fn(),
    openFile: vi.fn(),
    showOpenFolderDialog: vi.fn(),
    createFile: vi.fn(),
    createDir: vi.fn(),
    renameEntry: vi.fn(),
    deleteEntry: vi.fn(),
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
    ipc: {
      readDir,
      openFile,
      showOpenFolderDialog,
      createFile,
      createDir,
      renameEntry,
      deleteEntry,
    },
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

import { useConfirmStore } from "@shared/ui";

import { useEntryEditStore } from "../model/entry-edit-store";
import { useRecentSectionStore } from "../model/recent-section-store";
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
  useWorkspaceStore.setState({ rootDir: null, fileTree: [], expandedDirs: [], recentFiles: [] });
  useRecentSectionStore.setState({ collapsed: false });
  useDocumentStore.setState({ tabs: [], activeTabId: null });
  resetTreeNav();
  resetTabTextRegistry();
  readDir.mockReset();
  openFile.mockReset();
  showOpenFolderDialog.mockReset();
  createFile.mockReset();
  createDir.mockReset();
  useEntryEditStore.setState({ edit: null });
  useConfirmStore.setState({ pending: null });
  renameEntry.mockReset();
  deleteEntry.mockReset();
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
//       펼친 빈 폴더는 아무것도 표시하지 않음.
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

  // 집행: document-model.md#파일-트리-사이드바 — "펼친 폴더가 비어 있으면 아무것도 표시하지
  //       않는다".
  // 왜: 만드는 중에 "비어 있음"이 함께 뜨면 모순이었다 — 정책을 바꿔 빈 폴더는 표시를 없앴다.
  // 보장: 빈 폴더를 펼치면 펼친 채로 있고 안내 문구가 렌더되지 않는다.
  it("펼친 빈 폴더는 아무것도 표시하지 않는다", async () => {
    useWorkspaceStore.getState().openRoot("/vault", [NOTES_DIR]);
    readDir.mockResolvedValueOnce([]);
    const { getByTestId, queryByTestId } = render(<Sidebar />);

    fireEvent.click(getByTestId("tree-dir"));

    await waitFor(() => expect(getByTestId("tree-dir").getAttribute("aria-expanded")).toBe("true"));
    expect(queryByTestId("tree-empty")).toBeNull();
  });
});

// 집행: document-model.md#파일-트리-사이드바 — 항목 조작의 진입점과 인라인 입력 규칙.
// 왜: 입력칸은 만들어질 자리에 떠야 사용자가 어디에 생기는지 보고 판단한다. 기본 이름을
//     채워 Enter만으로도 만들 수 있게 하되, 확장자는 남기고 앞부분만 골라 둬야 바로
//     타이핑해 이름을 바꿀 수 있다.
// 보장: 헤더 버튼이 트리에 입력칸을 세우고, 기본 이름이 채워지며 앞부분만 선택된다.
//       Enter가 커맨드로 이어지고, Esc는 아무것도 만들지 않고 닫는다.
// 경계: 이름 규칙·번호 계산은 features/manage-entries가, 실제 파일 생성은 Rust가 검증한다.
describe("Sidebar 항목 만들기", () => {
  beforeEach(() => {
    useWorkspaceStore.setState({
      rootDir: "/vault",
      fileTree: [NOTES_DIR, README_FILE],
      expandedDirs: [],
    });
  });

  it("새 파일 버튼이 기본 이름을 채운 입력칸을 세우고 앞부분만 고른다", () => {
    const { getByTestId } = render(<Sidebar />);

    fireEvent.click(getByTestId("new-file"));

    const input = getByTestId("entry-name-input") as HTMLInputElement;
    expect(input.value).toBe("새 파일.md");
    // 확장자는 남기고 이름만 바꿀 수 있어야 한다.
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe("새 파일".length);
  });

  it("Enter는 입력한 이름으로 만들고 Esc는 아무것도 만들지 않는다", async () => {
    createFile.mockResolvedValue("/vault/회의.md");
    openFile.mockResolvedValue(fileContent("/vault/회의.md"));
    const { getByTestId, queryByTestId } = render(<Sidebar />);

    fireEvent.click(getByTestId("new-file"));
    fireEvent.change(getByTestId("entry-name-input"), { target: { value: "회의" } });
    fireEvent.keyDown(getByTestId("entry-name-input"), { key: "Enter" });

    await waitFor(() => expect(createFile).toHaveBeenCalledWith("/vault", "회의"));
    await waitFor(() => expect(queryByTestId("entry-name-input")).toBeNull());

    fireEvent.click(getByTestId("new-dir"));
    fireEvent.keyDown(getByTestId("entry-name-input"), { key: "Escape" });

    expect(queryByTestId("entry-name-input")).toBeNull();
    expect(createDir).not.toHaveBeenCalled();
  });

  // 집행: document-model.md#파일-트리-사이드바 — "입력칸 밖을 누르면 확정하되, 확정할 수
  //       없는 이름이면 취소한다".
  // 왜: 이름을 다 쳐 놓고 트리 밖을 누르는 것은 흔한 흐름이라 그때 버리면 다시 쳐야 한다.
  //     반대로 못 쓰는 이름인 채로 두면 포커스가 떠난 자리에 고칠 수 없는 입력칸이 남는다.
  // 보장: 쓸 수 있는 이름은 밖을 눌러도 만들어지고, 중복 이름은 만들지 않고 닫힌다.
  // 경계: 확정 뒤 늦게 오는 blur가 같은 이름을 또 만들지 않는지는 settled 표시가 막는다.
  it("밖을 누르면 확정하고 못 쓰는 이름이면 취소한다", async () => {
    createFile.mockResolvedValue("/vault/회의.md");
    openFile.mockResolvedValue(fileContent("/vault/회의.md"));
    const { getByTestId, queryByTestId } = render(<Sidebar />);

    fireEvent.click(getByTestId("new-file"));
    fireEvent.change(getByTestId("entry-name-input"), { target: { value: "회의" } });
    fireEvent.blur(getByTestId("entry-name-input"));

    await waitFor(() => expect(createFile).toHaveBeenCalledWith("/vault", "회의"));
    await waitFor(() => expect(queryByTestId("entry-name-input")).toBeNull());

    createFile.mockClear();
    fireEvent.click(getByTestId("new-file"));
    fireEvent.change(getByTestId("entry-name-input"), { target: { value: "readme" } });
    fireEvent.blur(getByTestId("entry-name-input"));

    expect(queryByTestId("entry-name-input")).toBeNull();
    expect(createFile).not.toHaveBeenCalled();
  });

  // 왜: 이미 있는 이름은 Rust가 거부한다 — 확정을 누른 뒤 알면 사용자는 이미 다 쳤다.
  // 보장: 중복 이름을 치면 경고가 뜨고 Enter가 커맨드로 가지 않는다.
  it("이미 있는 이름은 경고를 띄우고 만들지 않는다", () => {
    const { getByTestId } = render(<Sidebar />);

    fireEvent.click(getByTestId("new-file"));
    fireEvent.change(getByTestId("entry-name-input"), { target: { value: "readme" } });

    expect(getByTestId("entry-name-problem").textContent).toContain("이미 있습니다");

    fireEvent.keyDown(getByTestId("entry-name-input"), { key: "Enter" });
    expect(createFile).not.toHaveBeenCalled();
  });
});

// 집행: document-model.md#파일-트리-사이드바 — "하위 폴더에 만들 때는 그 항목의 컨텍스트
//       메뉴를 쓴다"·이름 변경과 삭제의 진입점.
// 왜: 헤더 버튼은 루트에만 만든다 — 트리 깊은 곳을 다루는 길이 없으면 폴더를 연 사람이
//     그 안에 파일 하나를 만들 수 없다.
// 보장: 우클릭이 그 항목의 메뉴를 열고, Escape로 닫히며, 이름 변경은 그 자리에 입력칸을
//       세우고, 삭제는 확인을 먼저 받는다.
// 경계: 메뉴 자체의 키보드 이동은 아래 테스트가, 커맨드 동작은 Rust가 검증한다.
describe("Sidebar 컨텍스트 메뉴", () => {
  beforeEach(() => {
    useWorkspaceStore.setState({
      rootDir: "/vault",
      fileTree: [NOTES_DIR, README_FILE],
      expandedDirs: [],
    });
  });

  it("우클릭하면 그 항목의 메뉴가 열리고 Escape로 닫힌다", () => {
    const { getAllByTestId, getByTestId, queryByTestId } = render(<Sidebar />);

    fireEvent.contextMenu(getAllByTestId("tree-file")[0]!);

    const menu = getByTestId("entry-context-menu");
    expect(menu.getAttribute("role")).toBe("menu");
    expect(menu.textContent).toContain("이름 변경");

    fireEvent.keyDown(menu, { key: "Escape" });
    expect(queryByTestId("entry-context-menu")).toBeNull();
  });

  it("이름 변경은 그 항목 자리에 입력칸을 띄운다", () => {
    const { getAllByTestId, getByTestId, queryByTestId } = render(<Sidebar />);

    fireEvent.contextMenu(getAllByTestId("tree-file")[0]!);
    fireEvent.click(getByTestId("menu-rename"));

    expect(queryByTestId("entry-context-menu")).toBeNull();
    expect((getByTestId("entry-name-input") as HTMLInputElement).value).toBe("readme.md");
  });

  // 왜: 폴더를 지우면 그 아래가 통째로 간다 — 되돌릴 수 있어도 확인 없이 사라지면 안 된다.
  // 보장: 삭제를 고르면 확인이 뜨고, 확인 전에는 커맨드가 불리지 않는다.
  it("삭제는 확인을 먼저 받는다", () => {
    const { getAllByTestId, getByTestId } = render(<Sidebar />);

    fireEvent.contextMenu(getAllByTestId("tree-file")[0]!);
    fireEvent.click(getByTestId("menu-delete"));

    expect(deleteEntry).not.toHaveBeenCalled();
    expect(useConfirmStore.getState().pending).not.toBeNull();
  });

  // 왜: 메뉴는 포인터 없이도 쓸 수 있어야 한다 — 트리가 이미 방향키로 도는데 메뉴만 마우스
  //     전용이면 키보드 사용자는 이름 변경·삭제에 닿지 못한다.
  // 보장: 열면 첫 항목에 포커스가 가고 방향키로 옮겨진다.
  it("열면 첫 항목에 포커스가 가고 방향키로 옮겨진다", () => {
    const { getAllByTestId, getByTestId } = render(<Sidebar />);

    fireEvent.contextMenu(getAllByTestId("tree-file")[0]!);

    const items = [...getByTestId("entry-context-menu").querySelectorAll('[role="menuitem"]')];
    expect(document.activeElement).toBe(items[0]);

    fireEvent.keyDown(getByTestId("entry-context-menu"), { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[1]);
  });
});

// 집행: document-model.md#최근-파일 — 파일명 표시·클릭 열기·접고 펼치기·
//       빈 목록 미표시·폴더 없이도 표시.
// 왜: 이 배선이 끊기면 최근 파일이 세션에 저장만 되고 화면에는 나오지 않는다.
// 보장: 목록의 파일명 표시(전체 경로는 title), 클릭 → 탭 열림, 헤더 토글로 목록이
//       숨고 다시 보임, 빈 목록은 영역 미표시, 트리가 있어도 영역이 뜬다.
// 경계: 목록의 순서·상한은 workspace-store 테스트, 없는 경로의 필터링은 Rust 소관.
//       접힘의 비영속은 스토어가 세션 저장에 실리지 않는 것으로 성립한다(별도 검증 없음).
describe("최근 파일 영역", () => {
  it("파일명으로 표시하고 누르면 그 파일을 연다", async () => {
    useWorkspaceStore.setState({ recentFiles: ["/vault/notes/회고.md", "/vault/할일.md"] });
    openFile.mockResolvedValue(fileContent("/vault/notes/회고.md"));
    const { getByTestId, getByTitle } = render(<Sidebar />);

    const items = [...getByTestId("recent-files").querySelectorAll("button")];
    expect(items.map((item) => item.textContent)).toEqual(["회고.md", "할일.md"]);
    expect(getByTitle("/vault/notes/회고.md")).toBeTruthy();

    fireEvent.click(items[0] as HTMLButtonElement);
    await waitFor(() => {
      expect(useDocumentStore.getState().tabs[0]?.filePath).toBe("/vault/notes/회고.md");
    });
  });

  it("헤더으로 접으면 목록이 숨고 다시 펼치면 돌아온다", () => {
    useWorkspaceStore.setState({ recentFiles: ["/vault/a.md"] });
    const { getByTestId, queryByTestId } = render(<Sidebar />);

    const toggle = getByTestId("recent-files-toggle");
    expect(toggle.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(toggle);
    expect(queryByTestId("recent-files")).toBeNull();
    expect(getByTestId("recent-files-toggle").getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(getByTestId("recent-files-toggle"));
    expect(queryByTestId("recent-files")).not.toBeNull();
  });

  // 집행: document-model.md#최근-파일 — "목록은 하나의 Tab 정지점이다(roving
  //       tabindex) — ↑↓·Home/End로 항목을 옮기고 Enter로 연다".
  // 왜: 항목마다 Tab 정지점이면 목록이 찰수록 트리(1 정지점)를 지나 설정까지 가는 Tab 횟수가
  //     늘고, 바로 위 트리와 탐색 방식이 어긋난다.
  // 보장: 정지점은 하나뿐이고 방향키·Home/End가 포커스를 옮긴다.
  // 경계: Enter 활성화는 버튼 기본 동작(브라우저 소관)이라 클릭 테스트가 같은 경로를 덮는다.
  it("목록은 Tab 정지점 하나이고 방향키로 항목을 옮긴다", () => {
    useWorkspaceStore.setState({ recentFiles: ["/vault/a.md", "/vault/b.md", "/vault/c.md"] });
    const { getByTestId } = render(<Sidebar />);

    const buttons = [...getByTestId("recent-files").querySelectorAll("button")];
    expect(buttons.map((button) => button.tabIndex)).toEqual([0, -1, -1]);

    (buttons[0] as HTMLButtonElement).focus();
    fireEvent.keyDown(buttons[0] as HTMLButtonElement, { key: "ArrowDown" });
    expect(document.activeElement).toBe(buttons[1]);
    expect((buttons[1] as HTMLButtonElement).tabIndex).toBe(0); // 정지점이 따라온다.

    fireEvent.keyDown(buttons[1] as HTMLButtonElement, { key: "End" });
    expect(document.activeElement).toBe(buttons[2]);
    fireEvent.keyDown(buttons[2] as HTMLButtonElement, { key: "Home" });
    expect(document.activeElement).toBe(buttons[0]);
  });

  it("목록이 비면 영역이 없고, 트리가 있어도 영역이 뜬다", () => {
    const { queryByTestId, rerender, getByTestId } = render(<Sidebar />);
    expect(queryByTestId("recent-files-section")).toBeNull();

    useWorkspaceStore.getState().openRoot("/vault", [README_FILE]);
    useWorkspaceStore.setState({ recentFiles: ["/vault/readme.md"] });
    rerender(<Sidebar />);
    expect(getByTestId("file-tree")).toBeTruthy();
    expect(getByTestId("recent-files-section")).toBeTruthy();
  });
});
