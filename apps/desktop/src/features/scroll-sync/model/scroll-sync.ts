// 소스↔프리뷰 스크롤 동기화의 중계소(→ preview-strategy.md#스크롤-동기화).
// 에디터·프리뷰 위젯은 같은 레이어라 서로 직접 참조할 수 없으므로(FSD), 이 feature가
// 둘 사이에서 "지금 소스 몇째 줄을 보고 있다"는 신호를 전달한다.

export type PaneId = "editor" | "preview";

/** 스크롤 위치의 소스 기준 좌표 — 1-기반 라인과 그 라인/블록 내 진행률(0~1). */
export interface ScrollPosition {
  line: number;
  fraction: number;
}

type ScrollListener = (position: ScrollPosition) => void;

const listenersByPane = new Map<PaneId, Set<ScrollListener>>();

/** 패널의 스크롤을 알린다 — 발행한 패널을 제외한 상대에게만 전달된다. */
export function publishScroll(source: PaneId, position: ScrollPosition): void {
  for (const [pane, listeners] of listenersByPane) {
    if (pane === source) {
      continue;
    }
    for (const listener of listeners) {
      listener(position);
    }
  }
}

/** 자기 패널(target) 앞으로 오는 동기화 신호를 구독한다. 반환값은 해제 함수. */
export function subscribeScroll(target: PaneId, listener: ScrollListener): () => void {
  let listeners = listenersByPane.get(target);
  if (!listeners) {
    listeners = new Set();
    listenersByPane.set(target, listeners);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 테스트 전용 — 구독 전체 초기화(테스트 간 누수 방지). */
export function resetScrollSync(): void {
  listenersByPane.clear();
}

export interface EchoGuard {
  /** 프로그램적 스크롤을 적용하기 직전에 부른다. */
  arm(): void;
  /** scroll 핸들러 진입 시 부른다 — true면 이 이벤트는 동기화가 만든 에코이므로 무시한다. */
  shouldIgnore(): boolean;
}

// 동기화가 만든 scroll 이벤트가 다시 신호를 만들면 두 패널이 무한 왕복한다.
// arm 1회 = 이벤트 1회 무시(카운터) — 빠른 연속 동기화로 이벤트가 밀려 와도 짝이 맞는다.
export function createEchoGuard(): EchoGuard {
  let pendingEchoes = 0;
  return {
    arm() {
      pendingEchoes += 1;
    },
    shouldIgnore() {
      if (pendingEchoes === 0) {
        return false;
      }
      pendingEchoes -= 1;
      return true;
    },
  };
}

/** 스크롤 적용 대상의 최소 표면 — DOM 요소와 CM6 scrollDOM 모두 만족한다. */
export interface ScrollTarget {
  scrollTop: number;
  readonly scrollHeight: number;
  readonly clientHeight: number;
}

/** "이미 그 자리" 판정 허용 오차 — 이 미만이면 대입해도 scroll 이벤트가 없다고 본다. */
export const SCROLL_APPLY_TOLERANCE_PX = 1;

/**
 * 프로그램적 스크롤을 에코 가드와 짝을 맞춰 적용한다.
 * 목표값을 스크롤 가능 범위 [0, max]로 먼저 클램프한다 — 범위 밖 목표로 대입이
 * 무효화되면 scroll 이벤트가 생기지 않아, arm만 쌓여 이후 진짜 사용자 스크롤이
 * 삼켜진다(가드 짝 어긋남). 클램프 후에도 이동이 없으면 arm하지 않는다.
 */
export function applyGuardedScrollTop(guard: EchoGuard, target: ScrollTarget, top: number): void {
  const maxTop = Math.max(0, target.scrollHeight - target.clientHeight);
  const clamped = Math.min(Math.max(top, 0), maxTop);
  if (Math.abs(target.scrollTop - clamped) < SCROLL_APPLY_TOLERANCE_PX) {
    return;
  }
  guard.arm();
  target.scrollTop = clamped;
}
