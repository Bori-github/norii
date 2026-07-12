import { describe, expect, it } from "vitest";

import type { Tab } from "@entities/document";

import { planCloseDefense } from "./close-defense";

function tab(overrides: Partial<Tab>): Tab {
  return {
    id: crypto.randomUUID(),
    filePath: "/vault/doc.md",
    title: "doc.md",
    isDirty: false,
    sourceEncoding: "utf-8",
    hasBom: false,
    eol: "lf",
    eolMixed: false,
    normalizationApproved: false,
    lastSavedHash: "hash",
    ...overrides,
  };
}

// 집행: file-lifecycle.md#종료-방어 — "경로가 있고 정규화 승인이 필요 없거나 이미 승인된 탭은
//       플러시, Untitled·정규화 미승인 dirty 탭이 있으면 다이얼로그".
// 왜: 이 분류가 틀리면 종료가 데이터를 버리거나(유실), 미승인 탭을 플러시에 포함해
//     종료가 정규화 승인을 우회해 무단 변환하거나, 매번 다이얼로그로 사용자를 막는다.
// 보장: 탭 상태 → {플러시 대상, 종료를 막는 탭}의 결정론적 분류.
// 경계: 실제 저장·창 닫기(비동기 흐름·플러시 실패 처리)는 use-close-guard·E2E 소관.
describe("planCloseDefense", () => {
  it("dirty 탭이 없으면 아무것도 하지 않는다(즉시 종료 허용)", () => {
    const plan = planCloseDefense([tab({}), tab({ filePath: null, title: "Untitled" })]);
    expect(plan).toEqual({ flushTabIds: [], blockingTabIds: [] });
  });

  it("경로 있는 dirty 탭은 플러시 대상이다", () => {
    const dirtyTab = tab({ isDirty: true });
    const plan = planCloseDefense([dirtyTab, tab({})]);
    expect(plan.flushTabIds).toEqual([dirtyTab.id]);
    expect(plan.blockingTabIds).toEqual([]);
  });

  it("Untitled dirty 탭은 플러시가 아니라 종료를 막는 탭이다", () => {
    const untitled = tab({ filePath: null, title: "Untitled", isDirty: true });
    const plan = planCloseDefense([untitled]);
    expect(plan.flushTabIds).toEqual([]);
    expect(plan.blockingTabIds).toEqual([untitled.id]);
  });

  it("혼합 상태에서는 플러시와 차단을 함께 분류한다", () => {
    const pathDirty = tab({ isDirty: true });
    const untitledDirty = tab({ filePath: null, isDirty: true });
    const clean = tab({});
    const plan = planCloseDefense([pathDirty, untitledDirty, clean]);
    expect(plan.flushTabIds).toEqual([pathDirty.id]);
    expect(plan.blockingTabIds).toEqual([untitledDirty.id]);
  });

  it("정규화 미승인 dirty 탭은 플러시가 아니라 종료를 막는 탭이다 (무단 변환 방지)", () => {
    const legacyDirty = tab({ sourceEncoding: "euc-kr", isDirty: true });
    const mixedDirty = tab({ eolMixed: true, isDirty: true });
    const plan = planCloseDefense([legacyDirty, mixedDirty]);
    expect(plan.flushTabIds).toEqual([]);
    expect(plan.blockingTabIds).toEqual([legacyDirty.id, mixedDirty.id]);
  });

  it("승인된 정규화 대상 dirty 탭은 플러시 대상이다", () => {
    const approved = tab({ sourceEncoding: "euc-kr", isDirty: true, normalizationApproved: true });
    const plan = planCloseDefense([approved]);
    expect(plan.flushTabIds).toEqual([approved.id]);
    expect(plan.blockingTabIds).toEqual([]);
  });
});
