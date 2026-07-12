import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";

import type { Tab } from "@entities/document";
import { findTab, setTabText, useDocumentStore } from "@entities/document";
import { STRINGS } from "@shared/config";
import { ipc } from "@shared/ipc";
import { logger } from "@shared/lib";
import { notifyIpcError } from "@shared/ui";

import { isTabInConflict, useConflictStore } from "./conflict-store";
import { isTabFileMissing, useMissingFileStore } from "./missing-file-store";
import { autosave, saveQueue } from "./save-tab";

// 외부 변경 처리 — 판정표의 단일 출처: file-lifecycle.md#외부-변경-처리.
// Rust watch가 보낸 file-changed/file-removed(→ rust-commands.md 이벤트 계약)를 받아
// 에코 무시·조용한 리로드·충돌 안내·삭제 표시로 나눈다.

/** file-changed 페이로드 — Rust FileChangedPayload(camelCase 직렬화)와 1:1. */
export interface FileChangedPayload {
  path: string;
  mtime: number;
  /** 이벤트 처리 시점의 디스크 내용 해시 — 에코 억제의 기준값. */
  hash: string;
}

/** file-removed 페이로드 — Rust FileRemovedPayload와 1:1. */
export interface FileRemovedPayload {
  path: string;
}

export async function handleFileChanged(payload: FileChangedPayload): Promise<void> {
  const tab = useDocumentStore.getState().tabs.find((t) => t.filePath === payload.path);
  if (!tab) {
    return; // 이미 닫힌 경로의 늦은 이벤트 — 무시.
  }
  const tabId = tab.id;
  // 저장 중 이벤트 지연 — 같은 탭의 저장 큐에 넣어, 진행 중인 저장이 끝나 lastSavedHash가
  // 갱신된 뒤에 판정한다. 이 지연이 없으면 자기 저장을 충돌로 오판한다(→ file-lifecycle.md).
  await saveQueue.enqueue(tabId, async () => {
    const current = findTab(tabId);
    if (!current || current.filePath !== payload.path) {
      return; // 큐 대기 중 탭이 닫혔거나 경로가 바뀜.
    }
    // 파일이 되살아났다 — 삭제 표시를 해제하고 일반 판정으로 넘어간다.
    if (isTabFileMissing(tabId)) {
      useMissingFileStore.getState().clearMissing(tabId);
      autosave.resume(tabId);
    }
    if (payload.hash === current.lastSavedHash) {
      return; // 자기 저장 에코 또는 동일 내용 — 무시.
    }
    if (isTabInConflict(tabId)) {
      return; // 이미 충돌 안내 중 — 사용자의 명시적 선택을 기다린다.
    }
    if (!current.isDirty) {
      // 조용히 리로드 — 편집 중이 아니므로 잃을 것이 없다.
      try {
        const file = await ipc.openFile(payload.path);
        // 재읽기 왕복 중 타이핑이 시작됐을 수 있다 — 재확인 없이 본문을 교체하면
        // 그 입력이 배너도 undo도 없이 사라진다(리뷰 P1-1). 편집이 생겼으면 충돌 분기로.
        const latest = findTab(tabId);
        if (!latest || latest.filePath !== payload.path) {
          return;
        }
        if (latest.isDirty) {
          useConflictStore.getState().markConflict(tabId);
          autosave.pause(tabId);
          return;
        }
        setTabText(tabId, file.text);
        useDocumentStore.getState().updateFileMeta(tabId, file);
      } catch (error) {
        notifyIpcError(STRINGS.openFailedTitle, error);
      }
      return;
    }
    // dirty — 충돌. 자동 병합은 하지 않고 사용자가 디스크/편집 버전을 고른다.
    useConflictStore.getState().markConflict(tabId);
    autosave.pause(tabId);
  });
}

export function handleFileRemoved(payload: FileRemovedPayload): void {
  const tab = useDocumentStore.getState().tabs.find((t) => t.filePath === payload.path);
  if (!tab) {
    return;
  }
  useMissingFileStore.getState().markMissing(tab.id);
  // 사용자가 밖에서 지운 파일을 자동 저장이 조용히 되살리지 않는다 — 재생성은
  // 명시적 저장(Cmd+S·배너 버튼)과 닫기/종료 플러시(데이터 보존 우선)만 한다.
  autosave.pause(tab.id);
}

/** 마지막으로 선언한 감시 집합의 서명 — 같은 집합의 반복 선언(IPC 폭주)을 막는다. */
let watchedSignature: string | null = null;

/**
 * 열린 경로 전체를 감시 대상으로 재선언한다(→ rust-commands.md watch_paths — 선언적 교체).
 * 스토어의 모든 변화(키 입력마다의 dirty 등)에서 불리므로, 경로 집합이 실제로 바뀔 때만
 * IPC를 보낸다.
 */
export async function syncWatchedPaths(tabs: Tab[]): Promise<void> {
  const paths = [
    ...new Set(tabs.flatMap((tab) => (tab.filePath === null ? [] : [tab.filePath]))),
  ].toSorted();
  const signature = paths.join("\n");
  if (signature === watchedSignature) {
    return;
  }
  watchedSignature = signature;
  try {
    await ipc.watchPaths(paths);
  } catch (error) {
    // 감시 실패는 치명적이지 않다 — 저장 직전 해시 검사가 마지막 방어선이다.
    // 서명을 되돌려 다음 탭 변화에서 재시도한다.
    watchedSignature = null;
    logger.warn(`파일 감시 선언 실패: ${String(error)}`);
  }
}

/** 테스트 전용 — 모듈 상태(감시 서명)를 초기화한다. */
export function resetWatchedPathsForTest(): void {
  watchedSignature = null;
}

/** 이벤트 구독과 감시 재선언을 시작한다. 반환값은 정리 함수(React effect 계약). */
export function initExternalChanges(): () => void {
  void syncWatchedPaths(useDocumentStore.getState().tabs);
  const unsubscribeStore = useDocumentStore.subscribe((state) => {
    void syncWatchedPaths(state.tabs);
  });
  const unlistenChanged = listen<FileChangedPayload>("file-changed", (event) => {
    void handleFileChanged(event.payload);
  });
  const unlistenRemoved = listen<FileRemovedPayload>("file-removed", (event) => {
    handleFileRemoved(event.payload);
  });
  return () => {
    unsubscribeStore();
    void unlistenChanged.then((unlisten) => unlisten());
    void unlistenRemoved.then((unlisten) => unlisten());
  };
}

/** 앱 셸에서 한 번 거는 외부 변경 구독 훅. */
export function useExternalChanges(): void {
  useEffect(() => initExternalChanges(), []);
}
