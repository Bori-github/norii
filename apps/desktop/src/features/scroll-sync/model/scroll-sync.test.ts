import { afterEach, describe, expect, it, vi } from "vitest";

import {
  applyGuardedScrollTop,
  createEchoGuard,
  createSwapSuppressor,
  publishScroll,
  resetScrollSync,
  subscribeScroll,
} from "./scroll-sync";

// 집행: preview-strategy.md#스크롤-동기화 — 소스↔프리뷰 스크롤 연동.
//
// 왜: FSD상 에디터·프리뷰 위젯은 서로 직접 참조할 수 없다(같은 레이어). 이 중계소가
//     둘 사이에서 "지금 소스 몇째 줄을 보고 있다"는 신호를 전달한다. 프로그램적
//     스크롤이 다시 신호를 만들면 두 패널이 무한 왕복하므로 에코 차단이 필수다.
// 보장: 신호는 발행한 패널을 제외한 상대에게만 전달되고, 해제·초기화가 동작하며,
//       에코 가드는 arm 1회당 scroll 이벤트 1회를 무시한다.
// 경계: 실제 DOM 스크롤 측정·적용(위젯 연결)과 라인↔픽셀 변환은 다루지 않는다 —
//       통합 검증은 editor-page 브라우저 테스트가 맡는다.
describe("스크롤 중계소 (publishScroll / subscribeScroll)", () => {
  afterEach(() => {
    resetScrollSync();
  });

  it("발행한 패널의 반대쪽 구독자에게만 전달한다", () => {
    const editorListener = vi.fn();
    const previewListener = vi.fn();
    subscribeScroll("editor", editorListener);
    subscribeScroll("preview", previewListener);

    publishScroll("editor", { line: 10, fraction: 0.5 });

    expect(previewListener).toHaveBeenCalledExactlyOnceWith({ line: 10, fraction: 0.5 });
    expect(editorListener).not.toHaveBeenCalled();
  });

  it("구독 해제 후에는 전달받지 않는다", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeScroll("preview", listener);
    unsubscribe();
    publishScroll("editor", { line: 1, fraction: 0 });
    expect(listener).not.toHaveBeenCalled();
  });

  it("resetScrollSync가 모든 구독을 정리한다 — 테스트 간 누수 방지", () => {
    const listener = vi.fn();
    subscribeScroll("preview", listener);
    resetScrollSync();
    publishScroll("editor", { line: 1, fraction: 0 });
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("스크롤 중계소 — 구독자 격리", () => {
  afterEach(() => {
    resetScrollSync();
  });

  it("한 구독자가 예외를 던져도 나머지 구독자와 발행 경로는 살아남는다", () => {
    // 발행은 스크롤 이벤트 경로에서 동기 호출된다 — 프리뷰 쪽 버그가
    // 에디터 경로(타이핑·리로드)까지 전파되면 안 된다.
    const healthy = vi.fn();
    subscribeScroll("preview", () => {
      throw new Error("구독자 버그");
    });
    subscribeScroll("preview", healthy);
    expect(() => publishScroll("editor", { line: 1, fraction: 0 })).not.toThrow();
    expect(healthy).toHaveBeenCalledOnce();
  });
});

function fakeTarget(scrollTop: number, scrollHeight = 1000, clientHeight = 400) {
  return { scrollTop, scrollHeight, clientHeight };
}

// 집행: preview-strategy.md#스크롤-동기화 — 프로그램적 스크롤의 가드 짝 맞춤.
// 왜: 목표값이 스크롤 가능 범위 밖이면 대입이 무효화되어 scroll 이벤트가 없다.
//     그때 arm만 쌓이면 이후 진짜 사용자 스크롤이 삼켜져 동기화가 조용히 죽는다.
// 보장: 목표는 [0, max]로 클램프되고, 실제로 움직일 때만 arm된다.
// 경계: 실제 DOM/CM6 대상 연결은 위젯·통합 테스트가 다룬다.
describe("applyGuardedScrollTop — 가드 짝 맞춤 적용", () => {
  it("범위 밖 목표는 최대 스크롤로 클램프해 적용한다", () => {
    const guard = createEchoGuard();
    const target = fakeTarget(100);
    applyGuardedScrollTop(guard, target, 99_999);
    expect(target.scrollTop).toBe(600); // 1000 - 400
    expect(guard.shouldIgnore()).toBe(true); // 움직였으므로 arm됨
  });

  it("이미 최대 위치인데 범위 밖 목표가 오면 arm하지 않는다 — 짝 어긋남 방지", () => {
    const guard = createEchoGuard();
    const target = fakeTarget(600);
    applyGuardedScrollTop(guard, target, 99_999);
    expect(target.scrollTop).toBe(600);
    expect(guard.shouldIgnore()).toBe(false); // scroll 이벤트가 없을 것이므로 arm 금지
  });

  it("음수 목표는 0으로 클램프하고, 이미 0이면 arm하지 않는다", () => {
    const guard = createEchoGuard();
    const target = fakeTarget(0);
    applyGuardedScrollTop(guard, target, -50);
    expect(target.scrollTop).toBe(0);
    expect(guard.shouldIgnore()).toBe(false);
  });

  it("허용 오차(1px) 미만의 이동은 적용하지 않는다", () => {
    const guard = createEchoGuard();
    const target = fakeTarget(100);
    applyGuardedScrollTop(guard, target, 100.5);
    expect(target.scrollTop).toBe(100);
    expect(guard.shouldIgnore()).toBe(false);
  });
});

// 왜: 본문이 짧아지면 브라우저가 프리뷰 scrollTop을 강제 보정하며 진짜 scroll 이벤트가
//     난다(에코 가드는 arm된 적 없음). 이를 발행하면 타이핑 중인 에디터가 당겨진다.
// 보장: 스왑 직후 창 안의 이벤트는 무시되고, 창이 지나면 정상 발행된다.
describe("createSwapSuppressor — 렌더 스왑 직후 발행 억제", () => {
  it("스왑 후 창 안은 무시, 창이 지나면 통과한다", () => {
    let now = 1000;
    const suppressor = createSwapSuppressor(150, () => now);
    expect(suppressor.shouldIgnore()).toBe(false); // 스왑 전엔 억제 없음
    suppressor.noteSwap();
    now = 1100;
    expect(suppressor.shouldIgnore()).toBe(true);
    now = 1200;
    expect(suppressor.shouldIgnore()).toBe(false);
  });
});

describe("에코 차단기 (createEchoGuard)", () => {
  it("arm 1회는 다음 scroll 이벤트 1회만 무시한다", () => {
    const guard = createEchoGuard();
    guard.arm();
    expect(guard.shouldIgnore()).toBe(true);
    // 그다음의 진짜 사용자 스크롤은 통과해야 한다.
    expect(guard.shouldIgnore()).toBe(false);
  });

  it("arm하지 않으면 아무것도 무시하지 않는다", () => {
    const guard = createEchoGuard();
    expect(guard.shouldIgnore()).toBe(false);
  });

  it("연속 arm은 그 횟수만큼 무시한다 — 빠른 연속 동기화에서 이벤트가 밀려 와도 안전", () => {
    const guard = createEchoGuard();
    guard.arm();
    guard.arm();
    expect(guard.shouldIgnore()).toBe(true);
    expect(guard.shouldIgnore()).toBe(true);
    expect(guard.shouldIgnore()).toBe(false);
  });
});
