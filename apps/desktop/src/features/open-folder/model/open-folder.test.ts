import { beforeEach, describe, expect, it, vi } from "vitest";

// IPC는 모킹한다 — 대상은 실제 디렉터리 읽기가 아니라 lazy 로딩·실패 처리 규칙이다
// (실제 read_dir 동작은 Rust 테스트가 검증 → testing.md#레이어별).
const { readDir, showOpenFolderDialog } = vi.hoisted(() => ({
  readDir: vi.fn(),
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
    ipc: { readDir, showOpenFolderDialog },
  };
});
vi.mock("@tauri-apps/plugin-log", () => ({
  error: vi.fn(async () => {}),
  warn: vi.fn(async () => {}),
  info: vi.fn(async () => {}),
}));

import { useWorkspaceStore } from "@entities/workspace";
import type { TreeNode } from "@shared/ipc";
import { IpcError } from "@shared/ipc";
import { useNoticeStore } from "@shared/ui";

import { openFolderInteractive, toggleDir } from "./open-folder";

const NOTES_DIR: TreeNode = {
  path: "/vault/notes",
  name: "notes",
  kind: "dir",
  isSymlink: false,
};
const DOC_FILE: TreeNode = {
  path: "/vault/notes/doc.md",
  name: "doc.md",
  kind: "file",
  isSymlink: false,
};

beforeEach(() => {
  useWorkspaceStore.setState({ rootDir: null, fileTree: [], expandedDirs: [] });
  useNoticeStore.setState({ notices: [] });
  readDir.mockReset();
  showOpenFolderDialog.mockReset();
});

// 집행: document-model.md#파일-트리-사이드바 — "루트 폴더를 열면 read_dir가 루트 한 단계를
//       반환"·rust-commands.md show_open_folder_dialog(취소 = None).
// 왜: 폴더 열기는 워크스페이스의 입구다 — 취소·실패가 반쯤 선 상태(루트만 있고 트리 없음)를
//     남기면 사이드바가 빈 폴더로 오해된다.
// 보장: 취소는 상태 불변, 성공은 루트+한 단계, 루트 읽기 실패는 워크스페이스를 세우지 않는다.
// 경계: 다이얼로그의 허용 루트 등록은 Rust 소관.
describe("openFolderInteractive", () => {
  it("취소하면 아무것도 바꾸지 않는다", async () => {
    showOpenFolderDialog.mockResolvedValueOnce(null);
    await openFolderInteractive();
    expect(useWorkspaceStore.getState().rootDir).toBeNull();
    expect(readDir).not.toHaveBeenCalled();
  });

  it("선택한 폴더의 한 단계로 워크스페이스를 세운다", async () => {
    showOpenFolderDialog.mockResolvedValueOnce("/vault");
    readDir.mockResolvedValueOnce([NOTES_DIR]);

    await openFolderInteractive();

    const state = useWorkspaceStore.getState();
    expect(state.rootDir).toBe("/vault");
    expect(state.fileTree.map((node) => node.name)).toEqual(["notes"]);
  });

  it("루트 읽기가 실패하면 워크스페이스를 세우지 않고 안내한다", async () => {
    showOpenFolderDialog.mockResolvedValueOnce("/vault");
    readDir.mockRejectedValueOnce(new IpcError("permission", "허용되지 않은 경로"));

    await openFolderInteractive();

    expect(useWorkspaceStore.getState().rootDir).toBeNull();
    expect(useNoticeStore.getState().notices).toHaveLength(1);
  });
});

// 집행: document-model.md#파일-트리-사이드바 — "폴더를 펼칠 때마다 그 폴더 한 단계를
//       다시 읽는다(레벨별 lazy)"·"children 부재 = 아직 안 읽음".
// 왜: 부재/빈 배열 구분이 무너지면 모든 폴더를 미리 읽거나(초기 비용 폭발) 빈 폴더에
//     IPC를 반복한다. 실패를 펼침으로 처리하면 안 읽은 폴더가 빈 폴더처럼 보인다.
// 보장: 첫 펼침만 read_dir 1회, 캐시된 폴더는 IPC 없이 펼침, 실패 시 펼치지 않고 안내.
// 경계: 외부 변경으로 인한 재읽기는 폴더 감시(단위 4) 소관.
describe("toggleDir", () => {
  beforeEach(() => {
    useWorkspaceStore.getState().openRoot("/vault", [NOTES_DIR]);
  });

  it("안 읽은 폴더의 첫 펼침은 한 단계를 읽어 붙인다", async () => {
    readDir.mockResolvedValueOnce([DOC_FILE]);

    await toggleDir("/vault/notes");

    expect(readDir).toHaveBeenCalledExactlyOnceWith("/vault/notes");
    const state = useWorkspaceStore.getState();
    expect(state.expandedDirs).toContain("/vault/notes");
    expect(state.fileTree[0]?.children?.map((node) => node.name)).toEqual(["doc.md"]);
  });

  it("접었다 다시 펼치면 캐시를 쓴다 (IPC 없음)", async () => {
    readDir.mockResolvedValueOnce([DOC_FILE]);
    await toggleDir("/vault/notes"); // 읽고 펼침
    await toggleDir("/vault/notes"); // 접힘
    await toggleDir("/vault/notes"); // 캐시로 펼침

    expect(readDir).toHaveBeenCalledTimes(1);
    expect(useWorkspaceStore.getState().expandedDirs).toContain("/vault/notes");
  });

  it("읽기에 실패하면 펼치지 않고 안내한다", async () => {
    readDir.mockRejectedValueOnce(new IpcError("io", "읽기 실패"));

    await toggleDir("/vault/notes");

    expect(useWorkspaceStore.getState().expandedDirs).toEqual([]);
    expect(useNoticeStore.getState().notices).toHaveLength(1);
  });
});
