import { findTab, setTabText, useDocumentStore } from "@entities/document";
import { STRINGS } from "@shared/config";
import { ipc } from "@shared/ipc";
import { notifyIpcError, useConfirmStore } from "@shared/ui";

// 파일 열기 — 다이얼로그로 경로를 얻고(스코프 등록의 입구, → rust-commands.md#권한-capabilities)
// 탭으로 연다. 이미 열린 파일이면 그 탭을 활성화한다(중복 탭 금지 → document-model.md).

/** 재해석 메뉴에 노출하는 WHATWG 라벨 — 주요 인코딩만 (→ file-lifecycle.md#인코딩-정책). */
export const REOPEN_ENCODINGS = ["utf-8", "euc-kr", "shift_jis", "utf-16le", "utf-16be"] as const;

export async function openFileInteractive(): Promise<void> {
  let path: string | null;
  try {
    path = await ipc.showOpenDialog();
  } catch (error) {
    notifyIpcError(STRINGS.openFailedTitle, error);
    return;
  }
  if (path === null) {
    return; // 사용자가 다이얼로그를 취소했다.
  }
  await openPathInTab(path);
}

export async function openPathInTab(path: string): Promise<void> {
  const store = useDocumentStore.getState();
  // 빠른 경로 — 같은 문자열은 같은 파일이라 IPC 없이 활성화한다. 표기만 다른 같은 파일
  // (별칭·대소문자·NFC/NFD)은 아래에서 열기 결과의 canonical 경로(file.path)로 잡는다
  // (→ document-model.md#다중-탭-규칙).
  const existing = store.tabs.find((tab) => tab.filePath === path);
  if (existing) {
    store.activateTab(existing.id);
    return;
  }
  try {
    const file = await ipc.openFile(path);
    useDocumentStore.getState().openFileTab(file);
  } catch (error) {
    // 바이너리·손상 파일의 열기 거부도 이 경로로 안내된다 — 파일은 건드리지 않았다.
    notifyIpcError(STRINGS.openFailedTitle, error);
  }
}

/**
 * 수동 재해석 — 파이프라인 판정을 건너뛰고 지정 인코딩으로 디스크를 다시 읽는다
 * ("Reopen with Encoding", → file-lifecycle.md#인코딩-정책). 감지 오판의 인앱 구제 수단이다.
 * 본문이 통째로 교체되므로 dirty 탭은 확인을 받는다(데이터 유실 방지 최우선).
 */
export async function reopenTabWithEncoding(tabId: string, encoding: string): Promise<void> {
  const tab = findTab(tabId);
  if (!tab || tab.filePath === null) {
    return;
  }
  const path = tab.filePath;
  if (tab.isDirty) {
    useConfirmStore.getState().requestConfirm({
      title: STRINGS.reopenDirtyTitle,
      body: STRINGS.reopenDirtyBody,
      confirmLabel: STRINGS.reopenConfirmLabel,
      cancelLabel: STRINGS.closeCancelLabel,
      onConfirm: () => void reopenNow(tabId, path, encoding),
    });
    return;
  }
  await reopenNow(tabId, path, encoding);
}

async function reopenNow(tabId: string, path: string, encoding: string): Promise<void> {
  try {
    const file = await ipc.openFile(path, encoding);
    setTabText(tabId, file.text);
    // updateFileMeta가 승인을 원점으로 되돌린다 — 재해석 결과도 저장 전 원본 불변이어야 한다.
    useDocumentStore.getState().updateFileMeta(tabId, file);
  } catch (error) {
    notifyIpcError(STRINGS.openFailedTitle, error);
  }
}
