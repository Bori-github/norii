import { needsNormalizationApproval } from "@entities/document";
import type { Tab } from "@entities/document";

// 종료 방어의 판단 로직 — 정책의 단일 출처: file-lifecycle.md#종료-방어.

export interface CloseDefensePlan {
  /** 종료 전 플러시(즉시 저장)할 탭 — 경로가 있고 정규화 승인이 필요 없거나 승인된 dirty 탭. */
  flushTabIds: string[];
  /**
   * 플러시로 해소할 수 없어 종료를 막는 탭 — Untitled dirty(저장할 경로가 없다)와
   * 정규화 미승인 dirty(플러시하면 종료가 승인을 우회해 무단 변환한다).
   */
  blockingTabIds: string[];
}

export function planCloseDefense(tabs: Tab[]): CloseDefensePlan {
  const flushTabIds: string[] = [];
  const blockingTabIds: string[] = [];
  for (const tab of tabs) {
    if (!tab.isDirty) {
      continue;
    }
    if (tab.filePath === null || needsNormalizationApproval(tab)) {
      blockingTabIds.push(tab.id);
    } else {
      flushTabIds.push(tab.id);
    }
  }
  return { flushTabIds, blockingTabIds };
}

export type CloseFlushOutcome = "close" | "confirm";

/**
 * 플러시 대상이 없어질 때까지(최대 maxAttempts회) 저장하고 종료 가부를 판정한다.
 * 저장 왕복 중 타이핑이 이어지면 dirty가 되살아나므로, 저장 결과("saved")만 믿지 않고
 * 최신 탭 상태를 다시 분류하는 재확인 루프가 필수다 — 없으면 그 편집이 조용히 유실된다
 * (적대적 리뷰 P1 → file-lifecycle.md#종료-방어).
 */
export async function flushUntilClean(
  getTabs: () => Tab[],
  save: (tabId: string) => Promise<string>,
  maxAttempts = 3,
): Promise<CloseFlushOutcome> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const plan = planCloseDefense(getTabs());
    if (plan.blockingTabIds.length > 0) {
      return "confirm"; // Untitled dirty — 플러시로 해소 불가.
    }
    if (plan.flushTabIds.length === 0) {
      return "close"; // 저장 대기분 없음 — 다이얼로그 없이 종료.
    }
    const outcomes = await Promise.all(plan.flushTabIds.map((id) => save(id)));
    if (outcomes.some((outcome) => outcome !== "saved" && outcome !== "skipped")) {
      return "confirm"; // 플러시 실패(에러·충돌) — 무단 종료는 유실이다.
    }
  }
  // 상한까지 계속 dirty — 입력이 이어지는 중. 무단 종료 대신 확인을 받는다.
  return "confirm";
}
