const UNUSED_FONT_SIZES = [
  "2xs",
  "lg",
  "xl",
  "2xl",
  "3xl",
  "4xl",
  "5xl",
  "6xl",
  "7xl",
  "8xl",
  "9xl",
];

const UNUSED_LINE_HEIGHTS = ["none", "tight", "snug", "normal", "relaxed", "loose"];

/**
 * 스케일에서 지울 토큰 경로 목록
 *
 * @description
 * 앱의 `panda.config`가 `config:resolved` 훅에서 `utils.omit`에 넘김 — 훅은 preset 안에서
 * 실행되지 않기 때문에 목록만 내보내고 훅에 등록하는 것은 앱이 함
 *
 * 이 목록이 토큰 타입 union을 좁히기 때문에 **앱과 이 패키지가 같은 목록을 써야 함** —
 * 다르면 이 패키지에서 타입이 통과한 토큰이 앱 CSS에 없음
 */
export const OMITTED_SCALE_PATHS = [
  ...UNUSED_FONT_SIZES.map((step) => `theme.tokens.fontSizes.${step}`),
  ...UNUSED_LINE_HEIGHTS.map((step) => `theme.tokens.lineHeights.${step}`),
];
