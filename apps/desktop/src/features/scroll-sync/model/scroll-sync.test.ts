import { afterEach, describe, expect, it, vi } from "vitest";

import { createEchoGuard, publishScroll, resetScrollSync, subscribeScroll } from "./scroll-sync";

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
