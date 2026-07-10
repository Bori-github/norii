import { describe, expect, it } from "vitest";

import { createSaveQueue } from "./save-queue";

// 집행: file-lifecycle.md#외부-변경-처리 — "저장이 진행 중인 경로"가 존재한다는 전제,
//       그리고 VS Code saveSequentializer와 같은 전략(저장 직렬화).
// 왜: 자동 저장 디바운스와 Cmd+S가 겹치면 같은 탭의 저장 두 개가 동시에 달릴 수 있다.
//     Rust 전역 잠금이 데이터 경쟁은 막지만, 프론트가 직렬화하지 않으면 뒤 저장이
//     앞 저장의 새 해시(lastSavedHash)를 모른 채 낡은 expectedHash로 나가 가짜 충돌이 뜬다.
// 보장: 같은 탭 키의 작업은 완료 순서가 제출 순서와 같고, 앞 작업의 실패가 뒤를 막지 않는다.
// 경계: 실제 저장 로직·IPC는 다루지 않는다 — 순수 직렬화 규칙만.
describe("createSaveQueue", () => {
  it("같은 키의 작업은 제출 순서대로 하나씩 실행된다", async () => {
    const queue = createSaveQueue();
    const log: string[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = queue.enqueue("tab-1", async () => {
      log.push("첫 작업 시작");
      await firstGate;
      log.push("첫 작업 끝");
    });
    const second = queue.enqueue("tab-1", async () => {
      log.push("둘째 작업 시작");
    });

    // 첫 작업이 끝나기 전에는 둘째가 시작되지 않는다.
    await Promise.resolve();
    expect(log).toEqual(["첫 작업 시작"]);

    releaseFirst();
    await Promise.all([first, second]);
    expect(log).toEqual(["첫 작업 시작", "첫 작업 끝", "둘째 작업 시작"]);
  });

  it("앞 작업이 실패해도 뒤 작업은 실행되고, 실패는 제출자에게 전달된다", async () => {
    const queue = createSaveQueue();
    const failing = queue.enqueue("tab-1", async () => {
      throw new Error("저장 실패");
    });
    const next = queue.enqueue("tab-1", async () => "성공");

    await expect(failing).rejects.toThrow("저장 실패");
    await expect(next).resolves.toBe("성공");
  });

  it("다른 키의 작업은 서로 기다리지 않는다", async () => {
    const queue = createSaveQueue();
    let releaseA!: () => void;
    const gateA = new Promise<void>((resolve) => {
      releaseA = resolve;
    });
    const log: string[] = [];

    const a = queue.enqueue("tab-a", async () => {
      await gateA;
      log.push("a");
    });
    const b = queue.enqueue("tab-b", async () => {
      log.push("b");
    });

    await b;
    expect(log).toEqual(["b"]);
    releaseA();
    await a;
    expect(log).toEqual(["b", "a"]);
  });
});
