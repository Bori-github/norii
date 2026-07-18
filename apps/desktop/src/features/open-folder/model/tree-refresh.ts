import { useEffect } from "react";

import { listen } from "@tauri-apps/api/event";

import { findTreeNode, useWorkspaceStore } from "@entities/workspace";
import { ipc } from "@shared/ipc";
import { logger } from "@shared/lib";

// 트리 외부 변경 반영 — Rust watch_tree의 dir-changed(→ rust-commands.md 이벤트 계약)를
// 받아, "읽어 둔 폴더만" 그 한 단계를 다시 읽어 병합한다. 정책의 단일 출처:
// document-model.md#파일-트리-사이드바.

/** dir-changed 페이로드 — Rust DirChangedPayload(camelCase 직렬화)와 1:1. */
interface DirChangedPayload {
  dir: string;
}

/** 마지막으로 선언한 감시 루트 — 같은 루트의 재선언 IPC를 막는다. */
let declaredRoot: string | null | undefined;

/**
 * 사이드바 루트의 폴더 감시를 재선언한다(→ rust-commands.md watch_tree — 선언적 교체).
 * 실패는 치명적이지 않다 — 트리가 낡을 뿐이고, 폴더 펼침이 최신을 읽는다.
 * 실패 시 캐시를 무효화해 다음 루트 변화에서 재시도한다.
 */
export async function syncTreeWatch(rootDir: string | null): Promise<void> {
  if (rootDir === declaredRoot) {
    return;
  }
  declaredRoot = rootDir;
  try {
    await ipc.watchTree(rootDir);
  } catch (error) {
    declaredRoot = undefined;
    logger.warn(`폴더 감시 선언 실패: ${String(error)}`);
  }
}

/**
 * dir-changed 처리 — 그 폴더를 이미 읽어 둔 경우에만(children 보유) 한 단계를 다시 읽어
 * 병합한다. 안 읽은 폴더는 무시한다(다음 펼침이 최신을 읽는다). 재읽기 실패도 조용히
 * 넘어간다 — 폴더 자체가 사라진 경우라면 부모의 dir-changed가 목록에서 지워 준다.
 */
export async function handleDirChanged(payload: DirChangedPayload): Promise<void> {
  const state = useWorkspaceStore.getState();
  if (state.rootDir === null) {
    return;
  }
  const isRoot = payload.dir === state.rootDir;
  if (!isRoot) {
    const node = findTreeNode(state.fileTree, payload.dir);
    if (node === undefined || node.kind !== "dir" || node.children === undefined) {
      return;
    }
  }
  try {
    const entries = await ipc.readDir(payload.dir);
    useWorkspaceStore.getState().refreshLevel(payload.dir, entries);
  } catch (error) {
    logger.warn(`트리 재읽기 실패(${payload.dir}): ${String(error)}`);
  }
}

/** 테스트 전용 — 감시 선언 캐시를 초기화한다. */
export function resetTreeWatchForTest(): void {
  declaredRoot = undefined;
}

/** 폴더 감시 선언과 dir-changed 구독을 시작한다. 반환값은 정리 함수(React effect 계약). */
export function initTreeWatch(): () => void {
  void syncTreeWatch(useWorkspaceStore.getState().rootDir);
  const unsubscribeStore = useWorkspaceStore.subscribe((state) => {
    void syncTreeWatch(state.rootDir);
  });
  const unlistenDirChanged = listen<DirChangedPayload>("dir-changed", (event) => {
    void handleDirChanged(event.payload);
  });
  return () => {
    unsubscribeStore();
    void unlistenDirChanged.then((unlisten) => unlisten());
  };
}

/** 앱 셸에서 한 번 거는 트리 감시 훅. */
export function useTreeWatch(): void {
  useEffect(() => initTreeWatch(), []);
}
