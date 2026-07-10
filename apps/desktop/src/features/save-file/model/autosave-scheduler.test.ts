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
