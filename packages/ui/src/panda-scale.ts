// 스케일에서 지우는 단계 — 소비 측 panda.config가 config:resolved 훅에서 쓴다.
// 훅은 preset 안에서 실행되지 않아 이 목록만 내주고, 거는 것은 소비 측이 한다.
//
// 두 설정이 서로 다른 단계를 남기면 같은 스타일이 다른 클래스 이름을 얻는다 —
// 패키지와 앱이 각자 codegen을 돌리므로 목록이 한 곳에 있어야 한다.

/** 쓰지 않는 크기 단계. 남겨 두면 스케일 밖 크기가 조용히 들어온다(→ decisions/typography). */
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

/** 쓰지 않는 행간 단계. 행간은 역할로 짓는다(ui · heading · editor · prose). */
const UNUSED_LINE_HEIGHTS = ["none", "tight", "snug", "normal", "relaxed", "loose"];

/** `utils.omit`에 넘길 경로 목록. */
export const OMITTED_SCALE_PATHS = [
  ...UNUSED_FONT_SIZES.map((step) => `theme.tokens.fontSizes.${step}`),
  ...UNUSED_LINE_HEIGHTS.map((step) => `theme.tokens.lineHeights.${step}`),
];
