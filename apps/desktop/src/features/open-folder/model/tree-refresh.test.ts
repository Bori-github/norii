import { beforeEach, describe, expect, it, vi } from "vitest";

// IPC는 모킹한다 — 대상은 실제 폴더 감시가 아니라 dir-changed 반영 규칙이다
// (감시·코얼레싱·숨김 필터는 Rust 테스트가 검증 → testing.md#레이어별).
const { readDir, watchTree } = vi.hoisted(() => ({
  readDir: vi.fn(),
  watchTree: vi.fn(async (_root: unknown) => {}),
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

import {
  handleDirChanged,
  handleTreeDesynced,
  resetTreeWatchForTest,
  syncTreeWatch,
} from "./tree-refresh";

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

  // 왜: readDir 응답 순서는 요청 순서와 같다는 보장이 없다 — 늦게 도착한 낡은 응답이
  //     최신 목록을 덮으면 다음 외부 변경까지 트리가 조용히 낡는다.
  //     await 전에 확인한 전제는 완료 후 재검증한다는 규칙의 적용이다.
  // 보장: 같은 폴더의 재읽기가 겹치면 마지막 요청의 응답만 트리에 반영된다(추월 무시).
  // 경계: 서로 다른 폴더의 재읽기는 독립이다 — 서로를 무효화하지 않는다.
  it("늦게 도착한 낡은 재읽기 응답은 최신 목록을 덮지 않는다", async () => {
    useWorkspaceStore.getState().openRoot("/vault", [file("/vault/old.md")]);
    let resolveFirst!: (entries: TreeNode[]) => void;
    readDir
      .mockReturnValueOnce(
        new Promise<TreeNode[]>((resolve) => {
          resolveFirst = resolve;
        }),
      )
      .mockResolvedValueOnce([file("/vault/newest.md")]);

    const first = handleDirChanged({ dir: "/vault" }); // 느린 요청(아직 미해결)
    const second = handleDirChanged({ dir: "/vault" }); // 빠른 요청 — 최신
    await second;
    resolveFirst([file("/vault/stale.md")]); // 낡은 응답이 뒤늦게 도착
    await first;

    expect(useWorkspaceStore.getState().fileTree.map((node) => node.name)).toEqual(["newest.md"]);
  });

  it("재읽기가 실패하면 트리를 그대로 둔다", async () => {
    useWorkspaceStore.getState().openRoot("/vault", [file("/vault/keep.md")]);
    readDir.mockRejectedValueOnce(new IpcError("io", "읽기 실패"));

    await handleDirChanged({ dir: "/vault" });

    expect(useWorkspaceStore.getState().fileTree.map((node) => node.name)).toEqual(["keep.md"]);
  });
});

// 집행: rust-commands.md tree-desynced — "프론트는 읽어 둔 모든 레벨을 다시 읽어 병합한다".
// 왜: 감시가 이벤트를 놓치면 무엇이 낡았는지 알 수 없는데, 읽어 둔 폴더의 펼침은 캐시를
//     쓰므로 이 신호가 유일한 보정 경로다. 안 읽은 폴더까지 읽으면 lazy 원칙이 무너진다.
// 보장: 루트와 children을 보유한 폴더만(중첩 포함) 다시 읽고, 안 읽은 폴더는 제외한다.
//       루트가 없으면 무시한다.
// 경계: 재읽기 각각의 세대 가드·병합은 위 테스트들이 다룬다.
describe("handleTreeDesynced", () => {
  it("루트와 읽어 둔 폴더만 다시 읽는다 (안 읽은 폴더 제외)", async () => {
    const store = useWorkspaceStore.getState();
    store.openRoot("/vault", [dir("/vault/loaded"), dir("/vault/unread")]);
    store.setChildren("/vault/loaded", [dir("/vault/loaded/inner")]);
    store.setChildren("/vault/loaded/inner", [file("/vault/loaded/inner/doc.md")]);
    readDir.mockResolvedValue([]);

    await handleTreeDesynced();

    expect(readDir.mock.calls.map(([target]) => target).toSorted()).toEqual([
      "/vault",
      "/vault/loaded",
      "/vault/loaded/inner",
    ]);
  });

  it("루트가 없으면 무시한다", async () => {
    await handleTreeDesynced();
    expect(readDir).not.toHaveBeenCalled();
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

  // 왜: 감시 선언 IPC가 동시에 두 개 떠 있으면 Rust 쪽 처리 순서가 호출 순서와 다를 수
  //     있다 — 낡은 선언(A)이 최신 선언(B)을 덮으면 프론트는 B를 감시 중이라 믿는 채
  //     트리가 조용히 낡는다. syncWatchedPaths의 latest-wins와 같은 규칙.
  // 보장: 선언은 한 번에 하나만 나가고(직렬), 대기 중 루트가 여러 번 바뀌면 마지막
  //       루트만 전달된다(중간 지시는 건너뜀).
  // 경계: Rust 쪽 실제 교체 동작은 tree_watch 테스트 소관.
  it("선언은 직렬로 나가고, 대기 중 바뀐 루트는 마지막 것만 전달된다", async () => {
    let resolveFirst!: () => void;
    watchTree.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveFirst = resolve;
      }),
    );

    const first = syncTreeWatch("/vault-a"); // 첫 선언 — IPC 진행 중
    const second = syncTreeWatch("/vault-b"); // 대기열에 등록
    const third = syncTreeWatch("/vault-c"); // 대기 중 최신으로 교체 — b는 건너뛴다

    expect(watchTree).toHaveBeenCalledTimes(1); // a가 끝나기 전에는 추가 발신 없음
    resolveFirst();
    await Promise.all([first, second, third]);

    expect(watchTree.mock.calls.map(([root]) => root)).toEqual(["/vault-a", "/vault-c"]);
  });
});
