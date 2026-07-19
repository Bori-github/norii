import { useEffect } from "react";

import { listen } from "@tauri-apps/api/event";

import type { FileTreeNode } from "@entities/workspace";
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

/** 마지막으로 선언한 감시 루트 — 같은 루트의 재선언 IPC를 막는다. undefined = 미선언/실패. */
let declaredRoot: string | null | undefined;
/** 대기 중인 최신 선언(latest-wins) — 드레인이 소비할 때까지 덮어쓴다. */
let pendingRoot: { root: string | null } | null = null;
/** 진행 중인 선언 드레인 — 하나만 돌며 선언 IPC를 직렬화한다(syncWatchedPaths와 동일 패턴). */
let watchDrain: Promise<void> | null = null;

/** 디렉터리별 재읽기 세대 — 순서 역전된 낡은 readDir 응답을 반영 직전에 걸러낸다. */
const refreshGeneration = new Map<string, number>();

/**
 * 사이드바 루트의 폴더 감시를 재선언한다(→ rust-commands.md watch_tree — 선언적 교체).
 * 선언 IPC는 한 번에 하나만 나간다 — 동시에 두 개가 떠 있으면 Rust 쪽 처리 순서가
 * 호출 순서와 달라 낡은 선언이 최신을 덮을 수 있다. 대기 중 루트가 바뀌면 마지막
 * 것만 전달한다(latest-wins). 실패는 치명적이지 않다 — 캐시를 무효화해 다음 루트
 * 변화에서 재시도한다.
 */
export function syncTreeWatch(rootDir: string | null): Promise<void> {
  pendingRoot = { root: rootDir };
  watchDrain ??= (async () => {
    try {
      while (pendingRoot !== null) {
        const next = pendingRoot;
        pendingRoot = null;
        await declareTreeWatch(next.root);
      }
    } finally {
      watchDrain = null;
    }
  })();
  return watchDrain;
}

async function declareTreeWatch(root: string | null): Promise<void> {
  if (root === declaredRoot) {
    return;
  }
  declaredRoot = root;
  try {
    await ipc.watchTree(root);
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
  const generation = (refreshGeneration.get(payload.dir) ?? 0) + 1;
  refreshGeneration.set(payload.dir, generation);
  try {
    const entries = await ipc.readDir(payload.dir);
    if (refreshGeneration.get(payload.dir) !== generation) {
      return;
    }
    useWorkspaceStore.getState().refreshLevel(payload.dir, entries);
  } catch (error) {
    logger.warn(`트리 재읽기 실패(${payload.dir}): ${String(error)}`);
  }
}

/**
 * tree-desynced 처리 — 감시 백엔드가 이벤트를 놓쳤다(→ rust-commands.md). 무엇을 놓쳤는지
 * 알 수 없고 읽어 둔 폴더의 펼침은 캐시를 쓰므로, 읽어 둔 모든 레벨을 다시 읽어 병합한다.
 * 각 재읽기는 handleDirChanged를 경유해 세대 가드·병합 규칙을 그대로 따른다.
 */
export async function handleTreeDesynced(): Promise<void> {
  const state = useWorkspaceStore.getState();
  if (state.rootDir === null) {
    return;
  }
  const dirs = [state.rootDir, ...collectLoadedDirs(state.fileTree)];
  await Promise.all(dirs.map((dir) => handleDirChanged({ dir })));
}

function collectLoadedDirs(nodes: FileTreeNode[]): string[] {
  const dirs: string[] = [];
  for (const node of nodes) {
    if (node.kind === "dir" && node.children !== undefined) {
      dirs.push(node.path);
      dirs.push(...collectLoadedDirs(node.children));
    }
  }
  return dirs;
}

/** 테스트 전용 — 감시 선언 캐시·드레인·재읽기 세대를 초기화한다. */
export function resetTreeWatchForTest(): void {
  declaredRoot = undefined;
  pendingRoot = null;
  watchDrain = null;
  refreshGeneration.clear();
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
  const unlistenDesynced = listen("tree-desynced", () => {
    void handleTreeDesynced();
  });
  return () => {
    unsubscribeStore();
    void unlistenDirChanged.then((unlisten) => unlisten());
    void unlistenDesynced.then((unlisten) => unlisten());
  };
}

/** 앱 셸에서 한 번 거는 트리 감시 훅. */
export function useTreeWatch(): void {
  useEffect(() => initTreeWatch(), []);
}
