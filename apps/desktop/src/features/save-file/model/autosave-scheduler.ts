// 자동 저장 디바운스 스케줄러 — 정책의 단일 출처: file-lifecycle.md#자동-저장.
// 타이핑이 멈추고 delayMs 후 flush(tabId)를 부른다. 충돌 중에는 pause로 멈추고,
// 해소 시 resume이 밀린 변경을 다시 예약한다.

export interface AutosaveScheduler {
  /** 문서가 바뀌었다 — 디바운스 타이머를 (재)시작한다. */
  noteChange(tabId: string): void;
  /** 충돌 등으로 이 탭의 자동 저장을 멈춘다. 변경은 기억해 뒀다 resume에서 예약한다. */
  pause(tabId: string): void;
  /** 일시 중지 해제 — 중지 중 변경이 있었으면 다시 예약한다. */
  resume(tabId: string): void;
  /** 예약 취소(수동 저장이 대신 처리한 경우) — 일시 중지 상태는 유지한다. */
  discard(tabId: string): void;
  /** 탭 제거 — 예약·밀린 변경·일시 중지를 모두 잊는다(닫힌 탭 id 누적 방지). */
  forget(tabId: string): void;
}

interface Options {
  delayMs: number;
  flush: (tabId: string) => void;
}

export function createAutosaveScheduler({ delayMs, flush }: Options): AutosaveScheduler {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const paused = new Set<string>();
  const pendingWhilePaused = new Set<string>();

  function clearTimer(tabId: string): void {
    const timer = timers.get(tabId);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.delete(tabId);
    }
  }

  function schedule(tabId: string): void {
    clearTimer(tabId);
    timers.set(
      tabId,
      setTimeout(() => {
        timers.delete(tabId);
        flush(tabId);
      }, delayMs),
    );
  }

  return {
    noteChange(tabId) {
      if (paused.has(tabId)) {
        pendingWhilePaused.add(tabId);
        return;
      }
      schedule(tabId);
    },
    pause(tabId) {
      paused.add(tabId);
      // 이미 예약된 플러시도 멈춘다 — 충돌 다이얼로그가 디바운스마다 반복되는 것을 막는다.
      if (timers.has(tabId)) {
        pendingWhilePaused.add(tabId);
        clearTimer(tabId);
      }
    },
    resume(tabId) {
      paused.delete(tabId);
      if (pendingWhilePaused.delete(tabId)) {
        schedule(tabId);
      }
    },
    discard(tabId) {
      clearTimer(tabId);
      pendingWhilePaused.delete(tabId);
    },
    forget(tabId) {
      clearTimer(tabId);
      pendingWhilePaused.delete(tabId);
      paused.delete(tabId);
    },
  };
}
