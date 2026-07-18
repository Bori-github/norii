import { beforeEach, describe, expect, it, vi } from "vitest";

// IPC는 모킹한다 — 대상은 실제 디코드가 아니라 재해석의 상태 전이·유실 방어 로직이다
// (실제 인코딩 변환은 Rust 테스트·E2E가 검증 → testing.md#레이어별).
const { openFile } = vi.hoisted(() => ({ openFile: vi.fn() }));

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
    ipc: { openFile, saveFile: vi.fn(), showOpenDialog: vi.fn(), showSaveDialog: vi.fn() },
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

import { openPathInTab, reopenTabWithEncoding } from "./open-file";

function fileContent(overrides: Partial<FileContent> = {}): FileContent {
  return {
    path: "/vault/legacy.md",
    text: "�� 깨진 본문\n",
    encoding: "euc-kr",
    hasBom: false,
    eol: "lf",
    eolMixed: false,
    mtime: 1_000,
    hash: "hash-1",
    ...overrides,
  };
}

beforeEach(() => {
  useDocumentStore.setState({ tabs: [], activeTabId: null });
  useConfirmStore.setState({ pending: null });
  useNoticeStore.setState({ notices: [] });
  resetTabTextRegistry();
  openFile.mockReset();
});

// 집행: document-model.md#다중-탭-규칙 — ""이미 열림" 판정은 open_file이 반환한 canonical
//       경로로 한다 — 같은 파일을 별칭으로 열어도 기존 탭에 합류한다".
// 왜: 신원이 요청 문자열이면 같은 파일이 별칭(/tmp↔/private/tmp 등)으로 두 탭이 되어
//     서로의 저장을 외부 변경으로 오인한다. M5 트리가 두 번째 입구가 되기 전에 고정한다.
// 보장: 요청 표기가 달라도 열기 결과의 canonical 경로가 같으면 새 탭 없이 기존 탭 활성화.
// 경계: 실제 canonicalize는 Rust 테스트 소관 — 여기는 반환값을 신원으로 쓰는 규칙만 다룬다.
describe("openPathInTab", () => {
  it("별칭 표기로 열어도 canonical 경로가 같으면 기존 탭에 합류한다", async () => {
    const existing = useDocumentStore
      .getState()
      .openFileTab(fileContent({ path: "/private/tmp/doc.md" }));
    useDocumentStore.getState().addUntitledTab(); // 활성 탭을 다른 곳으로 옮겨 둔다.
    openFile.mockResolvedValueOnce(fileContent({ path: "/private/tmp/doc.md" }));

    await openPathInTab("/tmp/doc.md"); // 별칭 표기 — 문자열은 기존 탭과 다르다.

    const { tabs, activeTabId } = useDocumentStore.getState();
    expect(tabs.filter((tab) => tab.filePath !== null)).toHaveLength(1);
    expect(activeTabId).toBe(existing);
  });
});

// 집행: file-lifecycle.md#인코딩-정책(수동 재해석) — 배너에서 다른 인코딩으로 다시 연다.
// 왜: chardetng 오판의 유일한 인앱 구제 수단이다 — 없으면 오판 파일은 norii에서 편집 불가.
// 보장: 재해석이 encoding_override로 다시 열어 본문·메타를 갱신하고 승인을 원점으로 돌리며,
//       편집 중(dirty) 탭은 확인 없이 본문을 버리지 않는다(데이터 유실 방지 최우선).
// 경계: 실제 라벨 디코드는 Rust 소관. 배너 표시·선택 UI는 위젯·E2E 소관.
describe("reopenTabWithEncoding", () => {
  function openLegacyTab(): string {
    return useDocumentStore.getState().openFileTab(fileContent({ path: "/vault/legacy.md" }));
  }

  it("지정 인코딩으로 다시 열어 본문과 메타를 갱신한다", async () => {
    const id = openLegacyTab();
    openFile.mockResolvedValueOnce(
      fileContent({ text: "한글 본문\n", encoding: "utf-16le", hash: "hash-2" }),
    );

    await reopenTabWithEncoding(id, "utf-16le");

    expect(openFile).toHaveBeenCalledWith("/vault/legacy.md", "utf-16le");
    expect(getTabText(id)).toBe("한글 본문\n");
    expect(useDocumentStore.getState().tabs[0]).toMatchObject({
      sourceEncoding: "utf-16le",
      lastSavedHash: "hash-2",
      normalizationApproved: false, // 재해석해도 승인은 원점 — 저장 전 원본 불변 안전망 유지.
      isDirty: false,
    });
  });

  it("dirty 탭은 확인을 받은 뒤에만 다시 연다 (편집 유실 방지)", async () => {
    const id = openLegacyTab();
    setTabText(id, "편집한 내용");
    useDocumentStore.getState().setDirty(id, true);
    openFile.mockResolvedValueOnce(fileContent({ text: "다시 읽음\n", encoding: "euc-kr" }));

    await reopenTabWithEncoding(id, "euc-kr");

    // 아직 열지 않았다 — 확인 대기.
    expect(openFile).not.toHaveBeenCalled();
    const pending = useConfirmStore.getState().pending;
    expect(pending?.title).toBe("편집 중인 문서 다시 열기");

    // 사용자가 확인하면 그때 다시 연다.
    pending?.onConfirm();
    await vi.waitFor(() => expect(openFile).toHaveBeenCalledTimes(1));
    expect(getTabText(id)).toBe("다시 읽음\n");
  });

  it("다시 열기가 실패하면 안내하고 탭을 그대로 둔다", async () => {
    const id = openLegacyTab();
    openFile.mockRejectedValueOnce(new IpcError("encoding", "알 수 없는 라벨"));

    await reopenTabWithEncoding(id, "no-such-encoding");

    expect(getTabText(id)).toBe("�� 깨진 본문\n");
    expect(useNoticeStore.getState().notices).toHaveLength(1);
    expect(useDocumentStore.getState().tabs).toHaveLength(1);
  });
});
