import { describe, expect, it } from "vitest";

import { adaptiveDebounceMs, PREVIEW_DEBOUNCE_BASE_MS, PREVIEW_DEBOUNCE_MAX_MS } from "./config";

// 집행: preview-strategy.md#디바운스 — 적응형 디바운스 clamp(직전 렌더 ms × 3, 150, 1000).
//
// 왜: 작은 문서는 즉각 반응해야 하고, 렌더가 디바운스보다 오래 걸리는 큰 문서는 짧은
//     멈춤마다 렌더가 끼어들어 타이핑이 버벅인다(M3 실측: 246KB 문서 렌더 202ms).
// 보장: 렌더가 빠르면 기본값, 무거우면 비례 확대, 상한을 넘지 않는다.
// 경계: 실제 렌더 시간 측정·타이머 동작은 use-preview-html(브라우저 테스트·통합)이 다룬다.
describe("adaptiveDebounceMs", () => {
  it("빠른 렌더(작은 문서)는 기본값을 쓴다", () => {
    expect(adaptiveDebounceMs(3)).toBe(PREVIEW_DEBOUNCE_BASE_MS);
    expect(adaptiveDebounceMs(0)).toBe(PREVIEW_DEBOUNCE_BASE_MS);
    // 기본값 ÷ 3 경계까지는 기본값이다.
    expect(adaptiveDebounceMs(50)).toBe(PREVIEW_DEBOUNCE_BASE_MS);
  });

  it("무거운 렌더는 비용의 3배로 간격을 벌린다", () => {
    expect(adaptiveDebounceMs(100)).toBe(300);
    expect(adaptiveDebounceMs(200)).toBe(600);
  });

  it("극단 문서도 상한(1000ms)을 넘지 않는다", () => {
    expect(adaptiveDebounceMs(472)).toBe(PREVIEW_DEBOUNCE_MAX_MS);
    expect(adaptiveDebounceMs(10_000)).toBe(PREVIEW_DEBOUNCE_MAX_MS);
  });
});
