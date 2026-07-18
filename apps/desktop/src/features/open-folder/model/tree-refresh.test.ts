import { beforeEach, describe, expect, it, vi } from "vitest";

// IPC는 모킹한다 — 대상은 실제 폴더 감시가 아니라 dir-changed 반영 규칙이다
// (감시·코얼레싱·숨김 필터는 Rust 테스트가 검증 → testing.md#레이어별).
const { readDir, watchTree } = vi.hoisted(() => ({
  readDir: vi.fn(),
  watchTree: vi.fn(async () => {}),
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
    ipc: { readDir, watchTree },
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

import { handleDirChanged, resetTreeWatchForTest, syncTreeWatch } from "./tree-refresh";

function dir(path: string): TreeNode {
  return { path, name: path.split("/").at(-1) ?? path, kind: "dir", isSymlink: false };
}

function file(path: string): TreeNode {
  return { path, name: path.split("/").at(-1) ?? path, kind: "file", isSymlink: false };
}

beforeEach(() => {
  useWorkspaceStore.setState({ rootDir: null, fileTree: [], expandedDirs: [] });
  resetTreeWatchForTest();
  readDir.mockReset();
  watchTree.mockReset();
  watchTree.mockResolvedValue(undefined);
});

// 집행: document-model.md#파일-트리-사이드바 — "dir-changed를 받은 프론트는 그 폴더를
//       이미 읽어 둔 경우에만 그 한 단계를 read_dir로 다시 읽어 병합한다".
// 왜: 모든 이벤트에 재읽기를 하면 안 읽은(접힌) 폴더까지 IPC가 나가 lazy 원칙이 무너지고,
//     루트 없는 상태의 이벤트 처리나 재읽기 실패가 트리를 오염시키면 안 된다.
// 보장: 루트·읽어 둔 폴더만 재읽기, 안 읽은 폴더·루트 없음은 무시, 실패는 상태 불변.
// 경계: 병합 규칙 자체는 workspace-store 테스트 소관.
describe("handleDirChanged", () => {
  it("루트의 변경은 루트 한 단계를 다시 읽어 병합한다", async () => {
    useWorkspaceStore.getState().openRoot("/vault", [file("/vault/old.md")]);
    readDir.mockResolvedValueOnce([file("/vault/new.md")]);

    await handleDirChanged({ dir: "/vault" });

    expect(readDir).toHaveBeenCalledExactlyOnceWith("/vault");
    expect(useWorkspaceStore.getState().fileTree.map((node) => node.name)).toEqual(["new.md"]);
  });

  it("읽어 둔 하위 폴더의 변경은 그 한 단계만 다시 읽는다", async () => {
    const store = useWorkspaceStore.getState();
    store.openRoot("/vault", [dir("/vault/notes")]);
    store.setChildren("/vault/notes", [file("/vault/notes/old.md")]);
    readDir.mockResolvedValueOnce([file("/vault/notes/new.md")]);

    await handleDirChanged({ dir: "/vault/notes" });

    expect(readDir).toHaveBeenCalledExactlyOnceWith("/vault/notes");
    const children = useWorkspaceStore.getState().fileTree[0]?.children;
    expect(children?.map((node) => node.name)).toEqual(["new.md"]);
  });

  it("안 읽은 폴더의 변경은 무시한다 (다음 펼침이 읽는다)", async () => {
    useWorkspaceStore.getState().openRoot("/vault", [dir("/vault/unread")]);

    await handleDirChanged({ dir: "/vault/unread" });

    expect(readDir).not.toHaveBeenCalled();
  });

  it("루트가 없으면 무시한다", async () => {
    await handleDirChanged({ dir: "/anywhere" });
    expect(readDir).not.toHaveBeenCalled();
  });

  it("재읽기가 실패하면 트리를 그대로 둔다", async () => {
    useWorkspaceStore.getState().openRoot("/vault", [file("/vault/keep.md")]);
    readDir.mockRejectedValueOnce(new IpcError("io", "읽기 실패"));

    await handleDirChanged({ dir: "/vault" });

    expect(useWorkspaceStore.getState().fileTree.map((node) => node.name)).toEqual(["keep.md"]);
  });
});

// 집행: rust-commands.md watch_tree — 선언적 교체(같은 루트 재선언 불필요)·실패 비치명.
// 왜: 스토어의 모든 변화에서 불릴 수 있으므로 루트가 실제로 바뀔 때만 IPC를 보내야 하고,
//     선언 실패가 캐시에 남으면 영구 미감시로 고착된다.
// 보장: 같은 루트는 1회만 선언, 실패 후 재호출은 다시 시도한다.
// 경계: 실제 감시 동작·이벤트 발생은 Rust 테스트 소관.
describe("syncTreeWatch", () => {
  it("같은 루트는 다시 선언하지 않는다", async () => {
    await syncTreeWatch("/vault");
    await syncTreeWatch("/vault");
    expect(watchTree).toHaveBeenCalledExactlyOnceWith("/vault");
  });

  it("선언이 실패하면 다음 호출이 재시도한다", async () => {
    watchTree.mockRejectedValueOnce(new IpcError("io", "감시 실패"));
    await syncTreeWatch("/vault");
    await syncTreeWatch("/vault");
    expect(watchTree).toHaveBeenCalledTimes(2);
  });
});
