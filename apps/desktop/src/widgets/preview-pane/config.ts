// 프리뷰 갱신 디바운스 — 매 키 입력마다 전체 재파싱하지 않는다(→ preview-strategy.md#디바운스).
// 잠정값이다. 구체 값은 M3 마감에서 실측으로 확정한다(→ implementation-plan.md 열린 결정
// "프리뷰 디바운스").
export const PREVIEW_DEBOUNCE_MS = 150;
