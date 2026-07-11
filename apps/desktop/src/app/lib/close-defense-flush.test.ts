import { describe, expect, it, vi } from "vitest";

import type { Tab } from "@entities/document";

import { flushUntilClean } from "./close-defense";

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
    lastSavedHash: "hash",
    ...overrides,
  };
}

// 집행: file-lifecycle.md#종료-방어 — 플러시 후에도 dirty가 남으면(저장 중 추가 편집)
//       종료하지 않는다. "saved" 반환값만 믿고 destroy하면 그 편집이 조용히 유실된다
//       (적대적 리뷰 P1이 찾은 유실 창).
// 왜: 종료는 마지막 관문이라 여기서 새는 편집은 복구 수단이 없다.
// 보장: 재확인 루프의 4가지 결말 — 전부 저장되면 close, 실패·Untitled·상한 초과는 confirm.
// 경계: 실제 창 파괴·확인 모달 표시는 use-close-guard·수동 검증 소관.
describe("flushUntilClean", () => {
  it("플러시가 전부 성공하고 dirty가 남지 않으면 close", async () => {
    let tabs = [tab({ isDirty: true }), tab({})];
    const save = vi.fn(async (tabId: string) => {
      tabs = tabs.map((t) => (t.id === tabId ? { ...t, isDirty: false } : t));
      return "saved";
    });
    await expect(flushUntilClean(() => tabs, save)).resolves.toBe("close");
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("저장 왕복 중 dirty가 재발하면 다시 플러시한 뒤에 close한다", async () => {
    const target = tab({ isDirty: true });
    let tabs = [target];
    let round = 0;
    const save = vi.fn(async () => {
      round += 1;
      // 1회차: 저장 중 추가 편집 — dirty 유지. 2회차: 깨끗해짐.
      tabs = [{ ...target, isDirty: round < 2 }];
      return "saved";
    });
    await expect(flushUntilClean(() => tabs, save)).resolves.toBe("close");
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("플러시가 실패(에러·충돌)하면 confirm — 무단 종료 금지", async () => {
    const tabs = [tab({ isDirty: true })];
    await expect(
      flushUntilClean(
        () => tabs,
        async () => "error",
      ),
    ).resolves.toBe("confirm");
    await expect(
      flushUntilClean(
        () => tabs,
        async () => "conflict",
      ),
    ).resolves.toBe("confirm");
  });

  it("Untitled dirty가 있으면 플러시 없이 confirm", async () => {
    const tabs = [tab({ filePath: null, isDirty: true })];
    const save = vi.fn(async () => "saved");
    await expect(flushUntilClean(() => tabs, save)).resolves.toBe("confirm");
    expect(save).not.toHaveBeenCalled();
  });

  it("상한까지 dirty가 계속 재발하면 confirm — 입력이 이어지는 중", async () => {
    const tabs = [tab({ isDirty: true })];
    const save = vi.fn(async () => "saved"); // dirty는 계속 true
    await expect(flushUntilClean(() => tabs, save, 3)).resolves.toBe("confirm");
    expect(save).toHaveBeenCalledTimes(3);
  });
});
