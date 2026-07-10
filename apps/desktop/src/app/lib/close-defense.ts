import type { Tab } from "@entities/document";

// 종료 방어의 판단 로직 — 정책의 단일 출처: file-lifecycle.md#종료-방어.
// M1은 정규화 미승인 탭이 존재하지 않으므로(비UTF-8·혼합 EOL은 열기 거부), 분류는 둘이다.
// M2에서 정규화 승인이 생기면 미승인 dirty 탭을 blocking으로 편입한다.

export interface CloseDefensePlan {
  /** 종료 전 플러시(즉시 저장)할 탭 — 경로 있는 dirty 탭. */
  flushTabIds: string[];
  /** 플러시로 해소할 수 없어 종료를 막는 탭 — Untitled dirty(저장할 경로가 없다). */
  blockingTabIds: string[];
}

export function planCloseDefense(tabs: Tab[]): CloseDefensePlan {
  const flushTabIds: string[] = [];
  const blockingTabIds: string[] = [];
  for (const tab of tabs) {
    if (!tab.isDirty) {
      continue;
    }
    if (tab.filePath === null) {
      blockingTabIds.push(tab.id);
    } else {
      flushTabIds.push(tab.id);
    }
  }
  return { flushTabIds, blockingTabIds };
}
