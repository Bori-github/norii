import { beforeEach, describe, expect, it, vi } from "vitest";

// IPC는 모킹한다 — 대상은 실제 파일 생성이 아니라 실패를 어디로 보내는가다
// (실제 커맨드 동작은 Rust 테스트가 검증 → testing.md#레이어별).
const { createDir, createFile, deleteEntry, renameEntry } = vi.hoisted(() => ({
  createDir: vi.fn(),
  createFile: vi.fn(),
  deleteEntry: vi.fn(),
  renameEntry: vi.fn(),
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
    ipc: { createDir, createFile, deleteEntry, renameEntry },
  };
});
vi.mock("@tauri-apps/plugin-log", () => ({
  error: vi.fn(async () => {}),
  warn: vi.fn(async () => {}),
  info: vi.fn(async () => {}),
}));

import { useDocumentStore } from "@entities/document";
import { IpcError } from "@shared/ipc";
import { useConfirmStore, useNoticeStore } from "@shared/ui";

import { createEntryIn, renameEntryTo, requestDeleteEntry } from "./manage-entries";

beforeEach(() => {
  vi.clearAllMocks();
  useNoticeStore.setState({ notices: [] });
  useConfirmStore.setState({ pending: null });
  useDocumentStore.setState({ tabs: [], activeTabId: null });
});

describe("createEntryIn · renameEntryTo", () => {
  // 왜: 만든 파일의 경로를 돌려받아야 호출한 쪽이 그 파일을 탭으로 열 수 있다
  //     (→ rust-commands.md#항목-조작 — 반환 경로가 탭 신원이다).
  // 보장: 종류에 맞는 커맨드로 부모 경로와 이름이 그대로 넘어가고, 성공하면 canonical 경로를 준다.
  // 경계: 확장자 수렴·이름 규칙 판정은 entry-name이 소유한다 — 여기서는 전달만 본다.
  it("종류에 맞는 커맨드를 부르고 새 경로를 돌려준다", async () => {
    createFile.mockResolvedValue("/vault/회의.md");
    createDir.mockResolvedValue("/vault/묶음");

    expect(await createEntryIn("/vault", "회의", "file")).toEqual({
      ok: true,
      path: "/vault/회의.md",
    });
    expect(createFile).toHaveBeenCalledWith("/vault", "회의");
    expect(await createEntryIn("/vault", "묶음", "dir")).toEqual({ ok: true, path: "/vault/묶음" });
    expect(createDir).toHaveBeenCalledWith("/vault", "묶음");
  });

  // 집행: document-model.md#다중-탭-규칙 — "이름을 바꾸면 그 파일의 탭이 새 경로를 가리킨다".
  // 왜: 탭이 옛 경로에 머무르면 파일 감시가 그 경로의 삭제를 보고 "파일이 사라졌습니다"를
  //     띄운다 — 이름만 바꿨는데 문서를 잃은 것처럼 보인다.
  // 보장: 이름 변경이 성공하면 열려 있던 탭이 새 경로를 가리킨다.
  // 경계: 어떤 탭이 따라가는지(폴더 아래까지)는 스토어의 retargetTabs가 소유한다.
  it("이름을 바꾸면 열린 탭이 새 경로를 따라간다", async () => {
    useDocumentStore.getState().openFileTab({
      path: "/vault/회의.md",
      text: "",
      encoding: "utf-8",
      hasBom: false,
      eol: "lf",
      eolMixed: false,
      mtime: 1,
      hash: "h",
    });
    renameEntry.mockResolvedValue("/vault/결산.md");

    await renameEntryTo("/vault/회의.md", "결산");

    expect(useDocumentStore.getState().tabs[0]?.filePath).toBe("/vault/결산.md");
  });

  // 왜: 중복·잘못된 이름은 사용자가 고쳐 쓰면 되는 것이라 입력칸 옆에 붙어야 한다.
  //     이것을 알림 배너로 띄우면 입력에서 눈을 떼야 하고 무엇을 고쳐야 할지도 흐려진다.
  // 보장: alreadyExists·invalidName은 문제 종류로 돌아오고 알림을 만들지 않는다.
  // 경계: 프론트도 입력 중에 같은 판정을 하지만(entry-name), 트리가 낡으면 여기로 온다.
  it("중복·이름 위반은 알림 대신 문제 종류로 돌려준다", async () => {
    createFile.mockRejectedValue(new IpcError("alreadyExists", "있음"));
    expect(await createEntryIn("/vault", "회의", "file")).toEqual({
      ok: false,
      problem: "duplicate",
    });

    renameEntry.mockRejectedValue(new IpcError("invalidName", "못 씀"));
    expect(await renameEntryTo("/vault/회의.md", ".숨김")).toEqual({
      ok: false,
      problem: "invalid",
    });

    expect(useNoticeStore.getState().notices).toHaveLength(0);
  });

  // 왜: 권한·디스크처럼 이름을 고쳐도 풀리지 않는 실패는 입력칸이 아니라 알림으로 알려야
  //     사용자가 다른 조치를 한다. 알리지 않으면 아무 일도 안 일어난 것처럼 보인다
  //     (→ error-handling.md).
  // 보장: 그 밖의 실패는 알림이 뜨고 failed로 돌아온다.
  // 경계: 알림 문구 자체는 shared/ui의 notifyIpcError가 만든다.
  it("그 밖의 실패는 알림으로 알린다", async () => {
    createFile.mockRejectedValue(new IpcError("permission", "권한 없음"));

    expect(await createEntryIn("/vault", "회의", "file")).toEqual({ ok: false, problem: "failed" });
    expect(useNoticeStore.getState().notices).toHaveLength(1);
  });
});

describe("requestDeleteEntry", () => {
  // 왜: 삭제는 휴지통으로 가 되돌릴 수 있지만, 폴더 하나를 잘못 지우면 그 아래가 통째로
  //     간다 — 확인을 한 번 받는다(→ 사용자 결정: 휴지통 이동 + 확인 모달).
  // 보장: 확인 전에는 커맨드가 불리지 않고, 취소하면 끝까지 불리지 않는다.
  // 경계: 모달의 생김새는 shared/ui의 confirm-dialog가 소유한다.
  it("확인을 받기 전에는 지우지 않는다", () => {
    requestDeleteEntry("/vault/회의.md", "회의.md");

    expect(deleteEntry).not.toHaveBeenCalled();
    expect(useConfirmStore.getState().pending).not.toBeNull();

    useConfirmStore.getState().settle(false);
    expect(deleteEntry).not.toHaveBeenCalled();
  });

  // 보장: 확인하면 그 경로로 삭제가 불린다.
  it("확인하면 그 경로를 지운다", async () => {
    deleteEntry.mockResolvedValue(null);
    requestDeleteEntry("/vault/회의.md", "회의.md");

    useConfirmStore.getState().settle(true);
    await vi.waitFor(() => expect(deleteEntry).toHaveBeenCalledWith("/vault/회의.md"));
  });

  // 왜: 삭제 실패를 알리지 않으면 항목이 그대로 남은 것을 사용자가 실패로 읽지 못한다.
  // 보장: 실패하면 알림이 뜬다.
  it("삭제 실패는 알림으로 알린다", async () => {
    deleteEntry.mockRejectedValue(new IpcError("io", "실패"));
    requestDeleteEntry("/vault/회의.md", "회의.md");

    useConfirmStore.getState().settle(true);
    await vi.waitFor(() => expect(useNoticeStore.getState().notices).toHaveLength(1));
  });
});
