import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAutosaveScheduler } from "./autosave-scheduler";

// 집행: file-lifecycle.md#자동-저장 — "탭에 저장 대기가 생긴 시점부터 그 간격이 지나면 저장",
//       "타이핑이 이어져도 예약을 미루지 않는다", "충돌 시 일시 중지…해소하면 재개".
// 왜: 예약을 미루면 긴 간격에서 계속 입력하는 동안 저장이 한 번도 나가지 않는다. 반대로 변경마다
//     예약하면 키를 누를 때마다 저장 IPC가 나간다. 충돌 중 중지가 없으면 다이얼로그가 반복된다.
// 보장: 첫 변경 기준 1회 플러시, 저장 뒤 다시 재기, 간격 변경 반영, 일시 중지·재개·취소의 상태 전이.
// 경계: 플러시가 실제로 저장하는지는 save-tab 로직·E2E 소관 — 여기선 호출 시점만.
function makeScheduler(interval = 2000) {
  const flush = vi.fn();
  let intervalMs = interval;
  const scheduler = createAutosaveScheduler({ intervalMs: () => intervalMs, flush });
  return {
    flush,
    scheduler,
    setInterval(next: number) {
      intervalMs = next;
    },
  };
}

describe("createAutosaveScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("변경 후 간격이 지나면 정확히 1회 플러시한다", () => {
    const { flush, scheduler } = makeScheduler();

    scheduler.noteChange("tab-1");
    vi.advanceTimersByTime(1999);
    expect(flush).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(flush).toHaveBeenCalledExactlyOnceWith("tab-1");
  });

  it("이어지는 변경은 예약을 미루지 않는다", () => {
    const { flush, scheduler } = makeScheduler();

    scheduler.noteChange("tab-1");
    vi.advanceTimersByTime(1500);
    scheduler.noteChange("tab-1"); // 타이핑 계속.
    vi.advanceTimersByTime(500);
    expect(flush).toHaveBeenCalledExactlyOnceWith("tab-1");
  });

  it("플러시한 뒤 다시 바뀌면 그때부터 다시 잰다", () => {
    const { flush, scheduler } = makeScheduler();

    scheduler.noteChange("tab-1");
    vi.advanceTimersByTime(2000);
    expect(flush).toHaveBeenCalledTimes(1);

    scheduler.noteChange("tab-1");
    vi.advanceTimersByTime(1999);
    expect(flush).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(flush).toHaveBeenCalledTimes(2);
  });

  // 왜: 간격을 생성 시점에 고정하면 설정을 바꿔도 앱을 다시 켤 때까지 옛 간격으로 돈다.
  // 경계: 이미 시작된 타이머는 그대로 만료된다 — 바뀐 간격은 다음 예약부터 적용된다.
  it("간격 설정이 바뀌면 다음 예약부터 그 값을 쓴다", () => {
    const { flush, scheduler, setInterval } = makeScheduler();

    setInterval(5000);
    scheduler.noteChange("tab-1");
    vi.advanceTimersByTime(2000);
    expect(flush).not.toHaveBeenCalled();
    vi.advanceTimersByTime(3000);
    expect(flush).toHaveBeenCalledExactlyOnceWith("tab-1");
  });

  it("일시 중지 중에는 변경이 와도 플러시하지 않고, 재개하면 다시 예약된다", () => {
    const { flush, scheduler } = makeScheduler();

    scheduler.pause("tab-1");
    scheduler.noteChange("tab-1");
    vi.advanceTimersByTime(5000);
    expect(flush).not.toHaveBeenCalled();

    // 재개(충돌 해소) — 중지 중 변경이 있었으므로 다시 예약된다.
    scheduler.resume("tab-1");
    vi.advanceTimersByTime(2000);
    expect(flush).toHaveBeenCalledExactlyOnceWith("tab-1");
  });

  it("취소하면 예약이 사라진다(탭 닫기·수동 저장 완료)", () => {
    const { flush, scheduler } = makeScheduler();

    scheduler.noteChange("tab-1");
    scheduler.discard("tab-1");
    vi.advanceTimersByTime(5000);
    expect(flush).not.toHaveBeenCalled();
  });

  // 왜: 취소는 예약만 지우므로, 그 뒤 첫 변경은 다시 예약을 걸어야 한다. 예약 유무만 보고
  //     건너뛰면 수동 저장 한 번 뒤로 그 탭의 자동 저장이 다시 예약되지 않는다.
  it("취소 뒤 다시 바뀌면 새로 예약한다", () => {
    const { flush, scheduler } = makeScheduler();

    scheduler.noteChange("tab-1");
    scheduler.discard("tab-1");
    scheduler.noteChange("tab-1");
    vi.advanceTimersByTime(2000);
    expect(flush).toHaveBeenCalledExactlyOnceWith("tab-1");
  });

  // 집행: file-lifecycle.md#자동-저장 — pause는 "충돌 해소까지" 유지되는 탭 상태다. 탭이
  //       닫히면 그 상태도 함께 사라져야 한다.
  // 왜: discard는 예약만 지우고 paused 집합은 남긴다 — 충돌·삭제 중 닫힌 탭 id가 세션 내내
  //     누적되고(누수), 같은 id가 재사용되면 새 탭이 영문 모르게 일시 중지로 시작한다.
  // 보장: forget은 예약·밀린 변경·일시 중지를 모두 지워 그 id를 초기 상태로 되돌린다.
  // 경계: 탭 id는 UUID라 재사용 확률은 낮다 — 주된 목적은 누수 차단이다.
  it("forget은 일시 중지 상태까지 초기화한다(닫힌 탭 잔존 방지)", () => {
    const { flush, scheduler } = makeScheduler();

    scheduler.pause("tab-1");
    scheduler.forget("tab-1");

    scheduler.noteChange("tab-1"); // forget 후에는 일시 중지가 남아 있으면 안 된다.
    vi.advanceTimersByTime(2000);
    expect(flush).toHaveBeenCalledExactlyOnceWith("tab-1");
  });

  it("탭별로 독립적으로 예약된다", () => {
    const { flush, scheduler } = makeScheduler();

    scheduler.noteChange("tab-1");
    vi.advanceTimersByTime(1000);
    scheduler.noteChange("tab-2");
    vi.advanceTimersByTime(1000);
    expect(flush).toHaveBeenCalledExactlyOnceWith("tab-1");
    vi.advanceTimersByTime(1000);
    expect(flush).toHaveBeenCalledTimes(2);
    expect(flush).toHaveBeenLastCalledWith("tab-2");
  });
});
