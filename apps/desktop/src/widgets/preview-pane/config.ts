// 프리뷰 갱신 디바운스 — 적응형. 값·근거의 단일 출처: preview-strategy.md#디바운스
// (M3 실측으로 확정). 매 키 입력마다 전체 재파싱하지 않는다.

/** 기본 디바운스 — 작은 문서의 즉각 반응 기준. */
export const PREVIEW_DEBOUNCE_BASE_MS = 150;

/** 상한 — 극단 문서에서도 프리뷰가 이보다 늦게 반응하지 않는다. */
export const PREVIEW_DEBOUNCE_MAX_MS = 1000;

/** 직전 렌더 소요의 배수 — 렌더가 무거울수록 간격을 비례해 벌린다. */
const PREVIEW_DEBOUNCE_RENDER_MULTIPLIER = 3;

/** 직전 렌더 소요(ms)로 다음 디바운스를 정한다 — clamp(렌더 × 3, 기본, 상한). */
export function adaptiveDebounceMs(lastRenderMs: number): number {
  return Math.min(
    Math.max(lastRenderMs * PREVIEW_DEBOUNCE_RENDER_MULTIPLIER, PREVIEW_DEBOUNCE_BASE_MS),
    PREVIEW_DEBOUNCE_MAX_MS,
  );
}
