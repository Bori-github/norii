import { defineConfig } from "@pandacss/dev";
import pandaPreset from "@pandacss/dev/presets";
import { createNoriiPreset } from "@norii/ui/panda-preset";

import { GLASS_OPACITY_DEFAULT } from "./src/shared/config/glass";

// 색 토큰은 @norii/ui의 preset이 소유한다(→ .claude/docs/design/design-system.md).
export default defineConfig({
  // presets를 지정하면 @pandacss/preset-panda가 자동으로 빠진다 — 명시하지 않으면
  // spacing·shadows·fontWeights 같은 프리셋 토큰이 통째로 사라진다.
  presets: [pandaPreset, createNoriiPreset({ glassOpacity: GLASS_OPACITY_DEFAULT })],

  // 스타일 추출 대상 — FSD 레이어 전체.
  include: ["./src/**/*.{ts,tsx}"],
  exclude: [],

  // CSS 리셋 포함.
  preflight: true,

  // 다크 테마는 루트의 data-theme 속성으로 켠다(상태는 entities/theme이 소유하고 app이 적용한다).
  // 기본 _dark(prefers-color-scheme 미디어) 대신 속성 기반으로 바꿔 앱이 테마를 완전히 제어한다.
  conditions: {
    extend: {
      dark: '[data-theme="dark"] &',
      // 창 유리가 켜졌는가 — "macOS인가"가 아니다. 유리를 끄면 macOS에서도 불투명 캔버스여야 한다
      // (→ .claude/docs/design/window-chrome.md#웹-쪽-계약--캔버스만-갈라진다).
      // dark 뒤에 정의해 두 조건이 겹칠 때 glass가 이긴다 — 유리가 켜지면 테마와 무관하게 투명이다.
      glass: '[data-glass="on"] &',
    },
  },

  // 프리셋의 안 쓰는 크기·행간 단계를 지운다(→ decisions/typography).
  hooks: {
    "config:resolved": ({ config, utils }) =>
      // omit의 반환 타입(Omit<UserConfig, string>)이 훅 시그니처와 안 맞아 원형으로 되돌린다.
      utils.omit(config, [
        ...["2xs", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl", "8xl", "9xl"].map(
          (step) => `theme.tokens.fontSizes.${step}`,
        ),
        ...["none", "tight", "snug", "normal", "relaxed", "loose"].map(
          (step) => `theme.tokens.lineHeights.${step}`,
        ),
      ]) as typeof config,
  },

  theme: {
    extend: {
      tokens: {
        fonts: {
          // 이름은 역할로 짓는다 — "본문"이 UI 산문인지 에디터 텍스트인지 가리지 못하는 이름은 쓰지 않는다.
          ui: {
            value:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
          },
          // 열 정렬이 의미를 갖는 구간(코드블록·표·들여쓰기)을 위한 고정폭(→ decisions/typography).
          editor: {
            value:
              '"Geist Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
          },
          // 프리뷰 산문(→ decisions/typography).
          prose: {
            value:
              '"Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
          },
        },

        // prose — 본문(md)에 대한 배수. 고정/배수의 경계는 decisions/typography가 소유한다.
        fontSizes: {
          prose: {
            h1: { value: "2em" },
            h2: { value: "1.5em" },
            h3: { value: "1.25em" },
            h4: { value: "1em" },
            // h5≈h6은 의도다(→ decisions/typography).
            h5: { value: "0.875em" },
            h6: { value: "0.85em" },
            code: { value: "0.875em" },
            footnotes: { value: "0.875em" },
            sup: { value: "0.75em" },
            label: { value: "0.875em" },
          },
        },

        lineHeights: {
          ui: { value: "1.4" },
          heading: { value: "1.3" },
          editor: { value: "1.6" },
          prose: { value: "1.8" },
        },

        // Panda 기본값(4·6·8px)보다 작게 잡는다(→ DESIGN.md 모서리).
        radii: {
          sm: { value: "2px" },
          md: { value: "4px" },
          lg: { value: "6px" },
        },
      },

      keyframes: {
        dialogIn: {
          from: { opacity: "0", transform: "translateY(6px) scale(0.99)" },
        },
        dialogOut: {
          to: { opacity: "0", transform: "translateY(4px) scale(0.99)" },
        },
      },

      // 포커스 링 — 어디에 쓰고 왜 text인지는 decisions/color-palette가 소유한다.
      // Panda 내장 focusRing 유틸은 안쪽 링을 offset 0으로 그리고 borderColor까지 바꿔 쓰지 않는다.
      layerStyles: {
        focusOutside: {
          value: {
            _focusVisible: { outline: "2px solid", outlineColor: "text", outlineOffset: "2px" },
          },
        },
        // 링이 밖으로 나갈 자리가 없을 때만 쓴다 — 잘라내는 묶음 안이거나 여백이 링보다 좁은 곳.
        focusInside: {
          value: {
            _focusVisible: { outline: "2px solid", outlineColor: "text", outlineOffset: "-2px" },
          },
        },
      },
    },
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
