import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAutosaveScheduler } from "./autosave-scheduler";

// 집행: file-lifecycle.md#자동-저장 — "타이핑 멈춤 후 디바운스(기본 2초) 자동 저장",
//       "충돌 시 해당 탭의 자동 저장을 일시 중지…해소하면 재개".
// 왜: 디바운스가 틀리면 매 키 입력마다 저장(IPC 폭주)하거나 영영 저장하지 않는다(유실).
//     충돌 중 일시 중지가 없으면 디바운스마다 충돌 다이얼로그가 반복된다.
// 보장: 마지막 변경 기준 지연 후 정확히 1회 플러시, 일시 중지·재개·취소의 상태 전이.
// 경계: 플러시가 실제로 저장하는지는 save-tab 로직·E2E 소관 — 여기선 호출 시점만.
describe("createAutosaveScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("변경 후 지연이 지나면 정확히 1회 플러시한다", () => {
    const flush = vi.fn();
    const scheduler = createAutosaveScheduler({ delayMs: 2000, flush });

    scheduler.noteChange("tab-1");
    vi.advanceTimersByTime(1999);
    expect(flush).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(flush).toHaveBeenCalledExactlyOnceWith("tab-1");
  });

  it("연속 변경은 마지막 변경 기준으로 디바운스된다", () => {
    const flush = vi.fn();
    const scheduler = createAutosaveScheduler({ delayMs: 2000, flush });

    scheduler.noteChange("tab-1");
    vi.advanceTimersByTime(1500);
    scheduler.noteChange("tab-1"); // 타이핑 계속 — 타이머 리셋
    vi.advanceTimersByTime(1500);
    expect(flush).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(flush).toHaveBeenCalledExactlyOnceWith("tab-1");
  });

  it("일시 중지 중에는 변경이 와도 플러시하지 않고, 재개하면 다시 예약된다", () => {
    const flush = vi.fn();
    const scheduler = createAutosaveScheduler({ delayMs: 2000, flush });

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
    const flush = vi.fn();
    const scheduler = createAutosaveScheduler({ delayMs: 2000, flush });

    scheduler.noteChange("tab-1");
    scheduler.discard("tab-1");
    vi.advanceTimersByTime(5000);
    expect(flush).not.toHaveBeenCalled();
  });

  // 집행: file-lifecycle.md#자동-저장 — pause는 "충돌 해소까지" 유지되는 탭 상태다. 탭이
  //       닫히면 그 상태도 함께 사라져야 한다.
  // 왜: discard는 예약만 지우고 paused 집합은 남긴다 — 충돌·삭제 중 닫힌 탭 id가 세션 내내
  //     누적되고(리뷰 P3 누수), 같은 id가 재사용되면 새 탭이 영문 모르게 일시 중지로 시작한다.
  // 보장: forget은 예약·밀린 변경·일시 중지를 모두 지워 그 id를 초기 상태로 되돌린다.
  // 경계: 탭 id는 UUID라 재사용 확률은 낮다 — 주된 목적은 누수 차단이다.
  it("forget은 일시 중지 상태까지 초기화한다(닫힌 탭 잔존 방지)", () => {
    const flush = vi.fn();
    const scheduler = createAutosaveScheduler({ delayMs: 2000, flush });

    scheduler.pause("tab-1");
    scheduler.forget("tab-1");

    scheduler.noteChange("tab-1"); // forget 후에는 일시 중지가 남아 있으면 안 된다.
    vi.advanceTimersByTime(2000);
    expect(flush).toHaveBeenCalledExactlyOnceWith("tab-1");
  });

  it("탭별로 독립적으로 예약된다", () => {
    const flush = vi.fn();
    const scheduler = createAutosaveScheduler({ delayMs: 2000, flush });

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
