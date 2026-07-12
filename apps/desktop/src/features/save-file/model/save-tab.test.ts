import { beforeEach, describe, expect, it, vi } from "vitest";

// IPC는 모킹한다 — 이 테스트의 대상은 실제 파일 I/O가 아니라 file-lifecycle.md 정책을
// 조립하는 상태 전이 로직이다(실제 왕복은 Rust 테스트·E2E가 검증 → testing.md#레이어별).
const { saveFile, openFile, showSaveDialog } = vi.hoisted(() => ({
  saveFile: vi.fn(),
  openFile: vi.fn(),
  showSaveDialog: vi.fn(),
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
    ipc: { saveFile, openFile, showSaveDialog, showOpenDialog: vi.fn() },
  };
});
vi.mock("@tauri-apps/plugin-log", () => ({
  error: vi.fn(async () => {}),
  warn: vi.fn(async () => {}),
  info: vi.fn(async () => {}),
}));

import { resetTabTextRegistry, setTabText, useDocumentStore } from "@entities/document";
import type { FileContent } from "@shared/ipc";
import { IpcError } from "@shared/ipc";
import { useConfirmStore, useNoticeStore } from "@shared/ui";

import { AUTOSAVE_DELAY_MS } from "../config";
import { useConflictStore } from "./conflict-store";
import {
  approveTabNormalization,
  noteDocumentChanged,
  requestCloseTab,
  resolveConflictKeepDisk,
  resolveConflictKeepMine,
  saveTabAs,
  saveTabNow,
} from "./save-tab";

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
  useConfirmStore.setState({ pending: null });
  useNoticeStore.setState({ notices: [] });
  resetTabTextRegistry();
  saveFile.mockReset();
  openFile.mockReset();
  showSaveDialog.mockReset();
});

// 집행: file-lifecycle.md#자동-저장 — "충돌 시 일시 중지…사용자가 해소하면 재개".
// 왜: 충돌 처리가 틀리면 자동 병합 금지 원칙이 무의미해지고, 디바운스마다 충돌이 반복된다.
// 보장: Conflict 에러 → 탭이 충돌 상태로 표시되고 outcome="conflict".
// 경계: 스케줄러의 pause 동작 자체는 autosave-scheduler.test가 검증한다.
describe("충돌 처리", () => {
  it("저장이 conflict로 실패하면 탭을 충돌 상태로 표시한다", async () => {
    const id = openTab();
    useDocumentStore.getState().setDirty(id, true);
    saveFile.mockRejectedValueOnce(new IpcError("conflict", "외부 변경"));

    await expect(saveTabNow(id)).resolves.toBe("conflict");
    expect(useConflictStore.getState().conflictTabIds).toContain(id);
  });

  it("내 편집으로 덮어쓰기 — expectedHash 없이 강제 저장하고 충돌을 해제한다", async () => {
    const id = openTab();
    useConflictStore.getState().markConflict(id);
    saveFile.mockResolvedValueOnce({ mtime: 2_000, hash: "hash-2" });

    await resolveConflictKeepMine(id);

    expect(saveFile).toHaveBeenCalledWith(expect.objectContaining({ expectedHash: null }));
    const tab = useDocumentStore.getState().tabs[0];
    expect(tab).toMatchObject({ lastSavedHash: "hash-2", isDirty: false });
    expect(useConflictStore.getState().conflictTabIds).not.toContain(id);
  });

  it("디스크 버전으로 되돌리기 — 본문·파일 메타를 리로드하고 충돌을 해제한다", async () => {
    const id = openTab();
    useConflictStore.getState().markConflict(id);
    openFile.mockResolvedValueOnce(fileContent({ text: "# 디스크\n", eol: "crlf", hash: "h3" }));

    await resolveConflictKeepDisk(id);

    const tab = useDocumentStore.getState().tabs[0];
    expect(tab).toMatchObject({ eol: "crlf", lastSavedHash: "h3", isDirty: false });
    expect(useConflictStore.getState().conflictTabIds).not.toContain(id);
  });
});

// 집행: file-lifecycle.md — "저장이 나가는 동안 추가 편집이 있었으면 dirty 유지"(그 편집은 미저장).
// 왜: 저장 응답만 믿고 dirty를 해제하면, IPC 왕복 중 타이핑이 저장된 척 표시된다.
// 보장: 저장 중 본문이 바뀌면 dirty가 유지되고 해시만 갱신된다.
// 경계: 재저장 트리거(자동 저장 재예약)는 에디터 docChanged 소관.
describe("저장 중 추가 편집", () => {
  it("저장 IPC 중 본문이 바뀌면 dirty를 유지한다", async () => {
    const id = openTab();
    useDocumentStore.getState().setDirty(id, true);
    saveFile.mockImplementationOnce(async () => {
      setTabText(id, "# 본문\n저장 중 추가 편집"); // IPC 왕복 중 타이핑 시뮬레이션
      return { mtime: 2_000, hash: "hash-2" };
    });

    await expect(saveTabNow(id)).resolves.toBe("saved");
    expect(useDocumentStore.getState().tabs[0]).toMatchObject({
      isDirty: true,
      lastSavedHash: "hash-2",
    });
  });
});

// 집행: file-lifecycle.md#자동-저장(정규화 승인) — "저장이 원본 바이트를 재작성하는 탭은
//       자동 저장이 꺼진 채 열린다…승인하거나 첫 수동 저장을 하면 승인된다…승인 후 첫 저장이
//       성공하면 탭 메타를 갱신한다(변환은 1회로 끝난다)".
// 왜: 이 게이트가 없으면 EUC-KR·혼합 EOL 파일을 여는 순간 자동 저장이 사용자 동의 없이
//     원본 바이트를 재작성한다 — "저장 전까지 원본 불변" 안전망이 깨진다.
// 보장: 미승인 탭은 디바운스가 지나도 저장되지 않고, 수동 저장은 승인으로 간주되며,
//       배너 승인은 밀린 변경의 자동 저장을 예약하고, 저장 성공 후 배너 근거 메타가 해제된다.
// 경계: Rust가 실제로 비UTF-8을 열어 주는 것은 M2 백엔드 단위(변환) 소관 — 여기는 메타가
//       이미 탭에 실렸다고 가정한 상태 전이만 다룬다. 배너 UI 연결은 위젯 소관.
describe("정규화 승인 게이팅", () => {
  function openLegacyTab(): string {
    return useDocumentStore
      .getState()
      .openFileTab("/vault/legacy.md", fileContent({ encoding: "euc-kr" }));
  }

  it("미승인 탭은 디바운스가 지나도 자동 저장되지 않는다", async () => {
    vi.useFakeTimers();
    try {
      const id = openLegacyTab();
      useDocumentStore.getState().setDirty(id, true);
      noteDocumentChanged(id);

      await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 2);
      expect(saveFile).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("수동 저장(Cmd+S)은 승인이다 — 저장 성공 후 정규화 메타가 해제된다", async () => {
    const id = openLegacyTab();
    useDocumentStore.getState().setDirty(id, true);
    saveFile.mockResolvedValueOnce({ mtime: 2_000, hash: "hash-2" });

    await expect(saveTabNow(id)).resolves.toBe("saved");

    expect(useDocumentStore.getState().tabs[0]).toMatchObject({
      normalizationApproved: true,
      sourceEncoding: "utf-8",
      eolMixed: false,
      isDirty: false,
    });
  });

  // 집행: file-lifecycle.md#자동-저장 — 승인은 "첫 수동 저장"으로 성립한다. 저장이 성립하지
  //       않았는데(취소·실패) 승인만 남으면, 이후 자동 저장이 사용자 동의 없이 원본 바이트를
  //       재작성한다 — M2 승인 관문의 우회다(리뷰 P1-2: 테스트+적대적 교차 확인).
  // 보장: 다이얼로그 취소·저장 실패는 승인을 남기지 않고, 승인은 저장 성공 시에만 기록된다.
  // 경계: 배너 버튼 승인(명시적 클릭)은 저장 없이도 즉시 승인이다 — 별도 테스트가 다룬다.
  it("다른 이름으로 저장을 취소하면 승인이 남지 않는다", async () => {
    const id = openLegacyTab();
    useDocumentStore.getState().setDirty(id, true);
    showSaveDialog.mockResolvedValueOnce(null); // 사용자가 다이얼로그를 취소했다.

    await expect(saveTabAs(id)).resolves.toBe("cancelled");

    expect(useDocumentStore.getState().tabs[0]).toMatchObject({
      normalizationApproved: false,
      sourceEncoding: "euc-kr",
    });
  });

  it("저장이 실패하면 승인이 남지 않는다", async () => {
    const id = openLegacyTab();
    useDocumentStore.getState().setDirty(id, true);
    saveFile.mockRejectedValueOnce(new IpcError("io", "디스크 오류"));

    await expect(saveTabNow(id)).resolves.toBe("error");

    expect(useDocumentStore.getState().tabs[0]).toMatchObject({
      normalizationApproved: false,
      sourceEncoding: "euc-kr",
    });
  });

  // 집행: file-lifecycle.md#자동-저장 — 승인 후 첫 저장 성공 시 메타 갱신(변환은 1회, 배너
  //       해제). 충돌 해소의 "내 편집으로 덮어쓰기"도 저장 성공이므로 같은 규칙을 따라야
  //       한다 — 아니면 디스크는 UTF-8인데 배너가 유령처럼 남는다(리뷰 P2).
  // 보장: 미승인 탭의 충돌 덮어쓰기 성공이 승인·정규화 메타를 일반 저장과 동일하게 갱신한다.
  // 경계: 덮어쓰기 자체의 강제 저장(expectedHash=null)은 기존 충돌 테스트가 다룬다.
  it("충돌 덮어쓰기 성공도 승인·정규화 메타를 갱신한다", async () => {
    const id = openLegacyTab();
    useDocumentStore.getState().setDirty(id, true);
    useConflictStore.getState().markConflict(id);
    saveFile.mockResolvedValueOnce({ mtime: 2_000, hash: "hash-2" });

    await resolveConflictKeepMine(id);

    expect(useDocumentStore.getState().tabs[0]).toMatchObject({
      normalizationApproved: true,
      sourceEncoding: "utf-8",
      eolMixed: false,
      lastSavedHash: "hash-2",
    });
  });

  it("배너 승인은 밀린 변경의 자동 저장을 예약한다", async () => {
    vi.useFakeTimers();
    try {
      const id = openLegacyTab();
      useDocumentStore.getState().setDirty(id, true);
      noteDocumentChanged(id); // 승인 전 — 예약되지 않는다.

      approveTabNormalization(id);
      saveFile.mockResolvedValueOnce({ mtime: 2_000, hash: "hash-2" });

      await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 2);
      expect(saveFile).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

// 집행: document-model.md#다중-탭-규칙(탭 닫기) — 플러시 후 닫기·Untitled 확인·실패 시 유지.
//       + 적대적 리뷰 P1: "saved" 후 dirty 재확인 없이 닫으면 저장 중 편집이 유실된다.
// 왜: 닫기는 본문이 버려지는 지점 — 여기의 분기 하나하나가 유실 방어선이다.
// 보장: 4가지 결말 — 깨끗하면 즉시 닫기, dirty 재발이면 재저장 후 닫기,
//       Untitled·저장 실패는 확인 요청, 충돌은 탭 유지.
// 경계: 확인 모달의 실제 표시·버튼은 confirm-store 테스트와 수동/E2E 소관.
describe("requestCloseTab", () => {
  it("깨끗한 탭은 저장 없이 즉시 닫는다", async () => {
    const id = openTab();
    await requestCloseTab(id);
    expect(useDocumentStore.getState().tabs).toHaveLength(0);
    expect(saveFile).not.toHaveBeenCalled();
  });

  it("저장 왕복 중 dirty가 재발하면 재저장한 뒤 닫는다 (유실 창 차단)", async () => {
    const id = openTab();
    useDocumentStore.getState().setDirty(id, true);
    saveFile
      .mockImplementationOnce(async () => {
        setTabText(id, "저장 중 편집 1"); // 1차 저장 중 추가 편집 → dirty 재발
        return { mtime: 2, hash: "h2" };
      })
      .mockResolvedValueOnce({ mtime: 3, hash: "h3" }); // 2차 저장은 깨끗하게 끝남

    await requestCloseTab(id);

    expect(saveFile).toHaveBeenCalledTimes(2);
    expect(useDocumentStore.getState().tabs).toHaveLength(0);
  });

  it("Untitled dirty는 저장 시도 없이 확인을 요청하고 탭을 유지한다", async () => {
    const id = useDocumentStore.getState().addUntitledTab();
    useDocumentStore.getState().setDirty(id, true);

    await requestCloseTab(id);

    expect(useDocumentStore.getState().tabs).toHaveLength(1);
    expect(useConfirmStore.getState().pending?.title).toBe("저장되지 않은 새 문서");
    expect(saveFile).not.toHaveBeenCalled();
  });

  it("정규화 미승인 dirty 탭은 저장(무단 변환) 없이 확인을 요청하고 탭을 유지한다", async () => {
    const id = useDocumentStore
      .getState()
      .openFileTab("/vault/legacy.md", fileContent({ encoding: "euc-kr" }));
    useDocumentStore.getState().setDirty(id, true);

    await requestCloseTab(id);

    expect(useDocumentStore.getState().tabs).toHaveLength(1);
    expect(useConfirmStore.getState().pending?.title).toBe("변환 승인 대기 중인 문서");
    expect(saveFile).not.toHaveBeenCalled();
  });

  it("저장 실패 시 확인을 요청하고 탭을 유지한다", async () => {
    const id = openTab();
    useDocumentStore.getState().setDirty(id, true);
    saveFile.mockRejectedValueOnce(new IpcError("io", "디스크 오류"));

    await requestCloseTab(id);

    expect(useDocumentStore.getState().tabs).toHaveLength(1);
    expect(useConfirmStore.getState().pending?.title).toBe("저장하지 못했습니다");
  });
});

// 집행: document-model.md#다중-탭-규칙 — 중복 탭 금지. 저장 경로 확정(save-as·첫 저장)도
//       이 불변식을 지켜야 한다(적대적 리뷰 P1 — 같은 파일 두 탭은 서로를 파괴한다).
// 왜: 같은 filePath 탭 둘은 서로 다른 lastSavedHash로 영구 충돌 핑퐁을 만든다.
// 보장: 이미 열린 경로로의 저장 확정은 거부되고 안내가 뜬다.
// 경계: OS 다이얼로그의 덮어쓰기 확인은 다루지 않는다(네이티브 소관).
describe("저장 경로 확정과 중복 탭 금지", () => {
  it("이미 열린 경로를 고르면 거부하고 안내한다", async () => {
    openTab("/vault/a.md");
    const untitled = useDocumentStore.getState().addUntitledTab();
    useDocumentStore.getState().setDirty(untitled, true);
    showSaveDialog.mockResolvedValueOnce("/vault/a.md");

    await expect(saveTabNow(untitled)).resolves.toBe("cancelled");

    expect(saveFile).not.toHaveBeenCalled();
    const untitledTab = useDocumentStore.getState().tabs.find((tab) => tab.id === untitled);
    expect(untitledTab?.filePath).toBeNull();
    expect(useNoticeStore.getState().notices).toHaveLength(1);
  });
});
