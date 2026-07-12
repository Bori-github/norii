import { beforeEach, describe, expect, it, vi } from "vitest";

// IPC는 모킹한다 — 대상은 실제 감시가 아니라 file-lifecycle.md#외부-변경-처리의
// 판정 규칙(에코 억제·리로드·충돌·삭제 표시)이다. 실제 watch 왕복은 Rust 테스트·E2E 소관.
const { saveFile, openFile, watchPaths } = vi.hoisted(() => ({
  saveFile: vi.fn(),
  openFile: vi.fn(),
  watchPaths: vi.fn(async () => {}),
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
    ipc: { saveFile, openFile, watchPaths, showOpenDialog: vi.fn(), showSaveDialog: vi.fn() },
  };
});
vi.mock("@tauri-apps/plugin-log", () => ({
  error: vi.fn(async () => {}),
  warn: vi.fn(async () => {}),
  info: vi.fn(async () => {}),
}));

import { getTabText, resetTabTextRegistry, setTabText, useDocumentStore } from "@entities/document";
import type { FileContent } from "@shared/ipc";
import { IpcError } from "@shared/ipc";
import { useConfirmStore, useNoticeStore } from "@shared/ui";

import { AUTOSAVE_DELAY_MS } from "../config";
import { useConflictStore } from "./conflict-store";
import {
  handleFileChanged,
  handleFileRemoved,
  resetWatchedPathsForTest,
  syncWatchedPaths,
} from "./external-changes";
import { isTabFileMissing, useMissingFileStore } from "./missing-file-store";
import { noteDocumentChanged, saveTabNow } from "./save-tab";

function fileContent(overrides: Partial<FileContent> = {}): FileContent {
  return {
    text: "# 본문\n",
    encoding: "utf-8",
    hasBom: false,
    eol: "lf",
    eolMixed: false,
    mtime: 1_000,
    hash: "hash-1",
    ...overrides,
  };
}

function openTab(path = "/vault/doc.md"): string {
  return useDocumentStore.getState().openFileTab(path, fileContent());
}

beforeEach(() => {
  useDocumentStore.setState({ tabs: [], activeTabId: null });
  useConflictStore.setState({ conflictTabIds: [] });
  useMissingFileStore.setState({ missingTabIds: [] });
  useConfirmStore.setState({ pending: null });
  useNoticeStore.setState({ notices: [] });
  resetTabTextRegistry();
  resetWatchedPathsForTest();
  saveFile.mockReset();
  openFile.mockReset();
  watchPaths.mockReset();
});

// 집행: file-lifecycle.md#외부-변경-처리 — 4갈래 판정표(에코 무시·조용한 리로드·충돌 안내)
//       + "자기 저장 에코 억제"(lastSavedHash 비교).
// 왜: 에코 억제가 없으면 자동 저장마다 "외부 변경" 처리가 오작동하고, dirty 판정이 틀리면
//     리로드가 편집을 덮어(유실) 버리거나 충돌 안내가 남발된다.
// 보장: 이벤트 해시=lastSavedHash → 무시, 깨끗한 탭 → 리로드, dirty 탭 → 충돌 표시.
// 경계: 실제 이벤트 발생(Rust watch)과 배너 표시는 각각 Rust 테스트·위젯 소관.
describe("handleFileChanged", () => {
  it("이벤트 해시가 lastSavedHash와 같으면 무시한다 (자기 저장 에코)", async () => {
    const id = openTab();
    await handleFileChanged({ path: "/vault/doc.md", mtime: 2_000, hash: "hash-1" });

    expect(openFile).not.toHaveBeenCalled();
    expect(useConflictStore.getState().conflictTabIds).not.toContain(id);
  });

  it("깨끗한 탭은 조용히 리로드한다", async () => {
    const id = openTab();
    openFile.mockResolvedValueOnce(fileContent({ text: "# 외부 수정\n", hash: "hash-2" }));

    await handleFileChanged({ path: "/vault/doc.md", mtime: 2_000, hash: "hash-2" });

    expect(openFile).toHaveBeenCalledWith("/vault/doc.md");
    expect(getTabText(id)).toBe("# 외부 수정\n");
    expect(useDocumentStore.getState().tabs[0]).toMatchObject({
      lastSavedHash: "hash-2",
      isDirty: false,
    });
  });

  it("dirty 탭은 리로드하지 않고 충돌로 표시한다 (자동 병합 금지)", async () => {
    const id = openTab();
    useDocumentStore.getState().setDirty(id, true);

    await handleFileChanged({ path: "/vault/doc.md", mtime: 2_000, hash: "hash-2" });

    expect(openFile).not.toHaveBeenCalled();
    expect(useConflictStore.getState().conflictTabIds).toContain(id);
  });

  it("열려 있지 않은 경로의 이벤트는 무시한다", async () => {
    openTab();
    await handleFileChanged({ path: "/vault/other.md", mtime: 2_000, hash: "hash-9" });
    expect(openFile).not.toHaveBeenCalled();
    expect(useConflictStore.getState().conflictTabIds).toHaveLength(0);
  });

  // 집행: file-lifecycle.md#외부-변경-처리 — 리로드는 "잃을 것이 없을" 때만 조용하다.
  // 왜: dirty 검사와 디스크 재읽기(IPC 왕복) 사이에 타이핑이 시작되면, 재확인 없는 리로드가
  //     그 입력을 통째로 덮어쓰고 dirty까지 지운다 — 배너도 undo도 없는 무통보 유실이다
  //     (리뷰 P1-1: 본체+적대적 교차 확인).
  // 보장: 리로드 IPC 중 편집이 생기면 본문을 교체하지 않고 충돌 분기로 전환한다.
  // 경계: 리로드 완료 후의 타이핑은 일반 편집 흐름이다 — 여기서 다루지 않는다.
  it("리로드 IPC 중 타이핑이 시작되면 덮어쓰지 않고 충돌로 전환한다", async () => {
    const id = openTab();
    openFile.mockImplementationOnce(async () => {
      // 재읽기 왕복 중 사용자가 타이핑을 시작했다.
      setTabText(id, "리로드 중 입력");
      useDocumentStore.getState().setDirty(id, true);
      return fileContent({ text: "# 외부 수정\n", hash: "hash-2" });
    });

    await handleFileChanged({ path: "/vault/doc.md", mtime: 2_000, hash: "hash-2" });

    expect(getTabText(id)).toBe("리로드 중 입력"); // 입력이 보존된다.
    expect(useDocumentStore.getState().tabs[0]).toMatchObject({ isDirty: true });
    expect(useConflictStore.getState().conflictTabIds).toContain(id);
  });

  it("리로드가 실패하면 본문·해시를 그대로 두고 안내한다", async () => {
    const id = openTab();
    setTabText(id, "# 본문\n");
    openFile.mockRejectedValueOnce(new IpcError("io", "읽기 실패"));

    await handleFileChanged({ path: "/vault/doc.md", mtime: 2_000, hash: "hash-2" });

    expect(getTabText(id)).toBe("# 본문\n");
    expect(useDocumentStore.getState().tabs[0]).toMatchObject({ lastSavedHash: "hash-1" });
    expect(useNoticeStore.getState().notices).toHaveLength(1);
  });

  it("이미 충돌 안내 중이면 추가 이벤트를 무시한다 (사용자 선택 대기)", async () => {
    const id = openTab();
    useConflictStore.getState().markConflict(id);

    await handleFileChanged({ path: "/vault/doc.md", mtime: 2_000, hash: "hash-2" });

    expect(openFile).not.toHaveBeenCalled();
    expect(useConflictStore.getState().conflictTabIds).toEqual([id]);
  });
});

// 집행: file-lifecycle.md#외부-변경-처리 — "저장 중 이벤트 지연: 저장이 진행 중인 경로의
//       file-changed는 그 저장이 끝난 뒤에 처리한다"(VS Code saveSequentializer와 동일).
// 왜: 이벤트가 저장 응답보다 먼저 도착하면 lastSavedHash가 아직 이전 값이라 자기 저장을
//     충돌로 오판한다 — 자동 저장 세계에서는 저장이 빈번해 이 경합이 일상적으로 일어난다.
// 보장: 저장 IPC가 진행 중일 때 도착한 그 저장의 에코가 저장 완료 후 판정되어 무시된다.
// 경계: 탭별 큐의 직렬화 자체는 save-queue 테스트 소관.
describe("저장 중 이벤트 지연", () => {
  it("저장 중 도착한 자기 에코는 저장 완료 후 판정되어 무시된다", async () => {
    const id = openTab();
    useDocumentStore.getState().setDirty(id, true);
    let finishSave!: (result: { mtime: number; hash: string }) => void;
    saveFile.mockReturnValueOnce(
      new Promise((resolve) => {
        finishSave = resolve;
      }),
    );

    const saving = saveTabNow(id);
    // 저장이 만든 file-changed가 저장 응답보다 먼저 도착한다.
    const handling = handleFileChanged({ path: "/vault/doc.md", mtime: 2_000, hash: "hash-2" });
    finishSave({ mtime: 2_000, hash: "hash-2" });
    await Promise.all([saving, handling]);

    expect(openFile).not.toHaveBeenCalled();
    expect(useConflictStore.getState().conflictTabIds).not.toContain(id);
  });
});

// 집행: file-lifecycle.md#외부-변경-처리 — "file-removed: 탭에 표시, 저장 시 새로 생성 선택"
//       + 삭제를 자동 저장이 조용히 되살리지 않는다(fs_commands의 삭제 Conflict와 같은 의도).
// 왜: 사용자가 밖에서 지운 파일을 자동 저장이 재생성하면 삭제 의도가 조용히 뒤집힌다.
//     반대로 명시적 저장까지 막으면 편집 내용을 구할 길이 없다(유실).
// 보장: 삭제 표시가 켜지고 자동 저장이 멈추며, 명시적 저장은 새로 생성(expectedHash=null)
//       후 표시를 해제한다. 외부에서 파일이 되살아나면 표시만 해제된다.
// 경계: 배너 UI·재생성 버튼은 위젯 소관. 닫기 플러시의 재생성은 데이터 보존 우선으로 허용.
describe("handleFileRemoved", () => {
  it("삭제 표시를 켜고 자동 저장을 멈춘다", async () => {
    vi.useFakeTimers();
    try {
      const id = openTab();
      // 디스크 재확인 — 정말 없다.
      openFile.mockRejectedValueOnce(new IpcError("notFound", "없음"));
      await handleFileRemoved({ path: "/vault/doc.md" });
      expect(isTabFileMissing(id)).toBe(true);

      useDocumentStore.getState().setDirty(id, true);
      noteDocumentChanged(id);
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 2);
      expect(saveFile).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("명시적 저장은 새로 생성하고(expectedHash=null) 삭제 표시를 해제한다", async () => {
    const id = openTab();
    useDocumentStore.getState().setDirty(id, true);
    openFile.mockRejectedValueOnce(new IpcError("notFound", "없음"));
    await handleFileRemoved({ path: "/vault/doc.md" });
    saveFile.mockResolvedValueOnce({ mtime: 2_000, hash: "hash-2" });

    await expect(saveTabNow(id)).resolves.toBe("saved");

    expect(saveFile).toHaveBeenCalledWith(expect.objectContaining({ expectedHash: null }));
    expect(isTabFileMissing(id)).toBe(false);
  });

  it("외부에서 파일이 되살아나면(file-changed) 삭제 표시를 해제한다", async () => {
    const id = openTab();
    openFile.mockRejectedValueOnce(new IpcError("notFound", "없음"));
    await handleFileRemoved({ path: "/vault/doc.md" });
    openFile.mockResolvedValueOnce(fileContent({ text: "# 되살아남\n", hash: "hash-3" }));

    await handleFileChanged({ path: "/vault/doc.md", mtime: 3_000, hash: "hash-3" });

    expect(isTabFileMissing(id)).toBe(false);
    expect(getTabText(id)).toBe("# 되살아남\n");
  });

  // 집행: file-lifecycle.md#외부-변경-처리 — 삭제 신호는 저장 큐로 지연하고, 처리 시점에
  //       디스크를 재확인해 정말 없을 때만 삭제로 처리한다(낡은 신호는 버린다).
  // 왜: "외부 삭제 → 내 저장이 재생성" 순서에서 유예(100ms)를 거친 삭제 신호가 저장
  //     성공 뒤에 도착하면, 멀쩡한 파일에 삭제 표시 + 자동 저장 정지가 남는다(리뷰 P2).
  // 보장: 재확인에서 파일이 존재하면 삭제 표시가 켜지지 않고 본문도 건드리지 않는다.
  //       존재를 단정할 수 없는 실패(권한 등)도 표시하지 않는다 — 삭제는 확실할 때만.
  // 경계: 실제 이벤트 타이밍(Rust 유예)은 Rust 테스트 소관 — 여기는 판정 규칙만.
  it("낡은 삭제 신호는 디스크 재확인으로 버린다 (파일이 살아 있음)", async () => {
    const id = openTab();
    setTabText(id, "# 본문\n");
    openFile.mockResolvedValueOnce(fileContent()); // 재확인 — 파일이 존재한다.

    await handleFileRemoved({ path: "/vault/doc.md" });

    expect(isTabFileMissing(id)).toBe(false);
    expect(getTabText(id)).toBe("# 본문\n"); // 재확인은 본문을 건드리지 않는다.
  });

  it("존재를 단정할 수 없으면(권한 등) 삭제 표시를 켜지 않는다", async () => {
    const id = openTab();
    openFile.mockRejectedValueOnce(new IpcError("permission", "권한 없음"));

    await handleFileRemoved({ path: "/vault/doc.md" });

    expect(isTabFileMissing(id)).toBe(false);
  });
});

// 집행: rust-commands.md watch_paths — "탭 목록이 바뀔 때마다 열린 경로 전체를 다시 선언".
// 왜: 재선언이 누락되면 새 탭의 외부 변경을 놓치고, 같은 목록을 반복 선언하면
//     스토어의 모든 상태 변화(키 입력마다의 dirty 등)가 IPC 폭주로 이어진다.
// 보장: 경로 집합이 바뀔 때만 watch_paths가 호출된다(같은 집합은 재호출 없음).
// 경계: Rust 쪽 교체·해제 동작은 Rust 테스트 소관.
describe("syncWatchedPaths", () => {
  it("경로 집합이 바뀔 때만 watch_paths를 호출한다", async () => {
    openTab("/vault/a.md");
    const tabs1 = useDocumentStore.getState().tabs;
    await syncWatchedPaths(tabs1);
    expect(watchPaths).toHaveBeenCalledTimes(1);
    expect(watchPaths).toHaveBeenCalledWith(["/vault/a.md"]);

    // 같은 집합(내용 동일) — 재호출하지 않는다.
    await syncWatchedPaths(tabs1);
    expect(watchPaths).toHaveBeenCalledTimes(1);

    openTab("/vault/b.md");
    await syncWatchedPaths(useDocumentStore.getState().tabs);
    expect(watchPaths).toHaveBeenCalledTimes(2);
    expect(watchPaths).toHaveBeenLastCalledWith(["/vault/a.md", "/vault/b.md"]);
  });

  it("Untitled(경로 없음) 탭은 감시 대상에서 제외한다", async () => {
    useDocumentStore.getState().addUntitledTab();
    await syncWatchedPaths(useDocumentStore.getState().tabs);
    expect(watchPaths).toHaveBeenCalledWith([]);
  });

  // 집행: external-changes의 계약 주석 — "서명을 되돌려 다음 탭 변화에서 재시도한다".
  // 왜: 실패 후 서명이 남으면 같은 경로 집합의 재선언이 영원히 건너뛰어져 세션 내내
  //     감시가 조용히 죽는다(외부 변경 전부 미감지) — 회귀를 잡는 테스트가 없었다(리뷰).
  // 보장: IPC 실패 후 같은 집합으로 다시 부르면 재시도(재호출)된다.
  // 경계: 실패 원인(Rust 쪽 사정)은 다루지 않는다 — 프론트 재시도 계약만.
  it("선언이 실패하면 같은 집합이라도 다음 호출에서 재시도한다", async () => {
    openTab("/vault/a.md");
    const tabs = useDocumentStore.getState().tabs;
    watchPaths.mockRejectedValueOnce(new IpcError("io", "감시 실패"));

    await syncWatchedPaths(tabs);
    await syncWatchedPaths(tabs); // 같은 집합 — 실패했으므로 건너뛰지 않고 재시도해야 한다.

    expect(watchPaths).toHaveBeenCalledTimes(2);
  });

  // 집행: rust-commands.md watch_paths(선언적 교체) — 재선언은 제출 순서대로 직렬화한다.
  // 왜: 동시 IPC 두 개의 완료 순서가 뒤집히면 옛 목록이 최종본이 되고, 프론트 서명 캐시가
  //     교정 재선언까지 막아 어긋난 채 고착된다(리뷰 P2).
  // 보장: 앞 선언의 IPC가 끝나기 전에는 다음 선언이 나가지 않는다(순서 보존).
  // 경계: Rust 쪽 교체의 원자성은 Rust 소관 — 여기는 호출 순서만.
  it("재선언은 앞 선언의 IPC가 끝난 뒤에만 나간다 (순서 보존)", async () => {
    openTab("/vault/a.md");
    const tabsA = useDocumentStore.getState().tabs;
    openTab("/vault/b.md");
    const tabsAB = useDocumentStore.getState().tabs;

    let finishFirst!: () => void;
    watchPaths.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishFirst = () => resolve();
      }),
    );

    const first = syncWatchedPaths(tabsA);
    const second = syncWatchedPaths(tabsAB);
    // 앞 IPC가 아직 진행 중 — 두 번째 선언은 나가면 안 된다.
    await Promise.resolve();
    expect(watchPaths).toHaveBeenCalledTimes(1);

    finishFirst();
    await Promise.all([first, second]);
    expect(watchPaths).toHaveBeenCalledTimes(2);
    expect(watchPaths).toHaveBeenLastCalledWith(["/vault/a.md", "/vault/b.md"]);
  });
});
