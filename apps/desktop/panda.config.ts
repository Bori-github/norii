import { defineConfig } from "@pandacss/dev";
import pandaPreset from "@pandacss/dev/presets";
import { OMITTED_SCALE_PATHS } from "@norii/ui/panda-scale";

import { noriiPreset } from "./src/shared/config/norii-preset";

// 색 토큰은 @norii/ui의 preset이 소유한다(→ .claude/docs/design/design-system.md).
export default defineConfig({
  // presets를 지정하면 @pandacss/preset-panda가 자동으로 빠진다 — 명시하지 않으면
  // spacing·shadows·fontWeights 같은 프리셋 토큰이 통째로 사라진다.
  presets: [pandaPreset, noriiPreset],

  // 스타일 추출 대상 — FSD 레이어 전체와 @norii/ui의 컴포넌트 소스.
  // 패키지 소스를 넣지 않으면 그 안에서만 쓰인 스타일이 앱 CSS에 나오지 않는다.
  include: ["./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  exclude: [],

  // CSS 리셋 포함.
  preflight: true,

  // 안 쓰는 크기·행간 단계를 지운다(→ @norii/ui의 panda-scale.ts).
  hooks: {
    "config:resolved": ({ config, utils }) =>
      // omit의 반환 타입(Omit<UserConfig, string>)이 훅 시그니처와 안 맞아 원형으로 되돌린다.
      utils.omit(config, OMITTED_SCALE_PATHS) as typeof config,
  },

  // 앱 전역 표면 — 시맨틱 토큰으로 배경·글자·높이를 잡는다.
  globalCss: {
    // overscroll-behavior 없이는 스크롤할 콘텐츠가 없어도 WKWebView가 페이지 전체를
    // 탄성 오버스크롤(러버밴드)로 튕겨, 창이 흔들리는 것처럼 보인다.
    "html, body, #root": { height: "100%", overscrollBehavior: "none" },
    body: {
      margin: "0",
      background: "bg.canvas",
      color: "text",
      fontFamily: "ui",
      lineHeight: "ui",
    },

    "::-webkit-scrollbar": { width: "10px", height: "10px" },
    "::-webkit-scrollbar-track": { background: "transparent" },
    // thumb 둘레의 여백은 투명 테두리로 만든다 — 배경을 content-box까지만 칠한다.
    "::-webkit-scrollbar-thumb": {
      backgroundColor: "bg.scrollbar",
      backgroundClip: "content-box",
      borderWidth: "3px",
      borderStyle: "solid",
      borderColor: "transparent",
      borderRadius: "full",
    },
    "::-webkit-scrollbar-thumb:hover": { backgroundColor: "bg.scrollbarHover" },
    "::-webkit-scrollbar-corner": { background: "transparent" },
  },

  // 생성물 위치 — VCS 제외(→ .claude/docs/project-structure.md).
  outdir: "styled-system",
});
