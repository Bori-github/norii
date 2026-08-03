import { defineConfig } from "@pandacss/dev";

import { GLASS_OPACITY_DEFAULT } from "./src/shared/config/glass";

// 디자인 시스템 토큰·조건의 단일 출처(→ .claude/docs/design/design-system.md).
// 컴포넌트는 시맨틱 토큰만 참조하고, 원시값은 이 파일의 토큰 정의 계층에만 둔다.
//
// 색 값은 대비 게이트를 통과한 것만 들어온다(src/shared/config/design-tokens.test.ts).
// 특히 bg.chrome의 알파는 취향이 아니라 계산 결과다 — 낮추면 유리가 더 투명해지지만
// 밝은 바탕화면 위에서 크롬 글자가 먼저 안 읽히게 되어 테스트가 막는다.
export default defineConfig({
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
      // 원시 토큰 — 팔레트의 실제 값. 시맨틱 토큰이 이걸 참조한다.
      tokens: {
        colors: {
          // oklch(L C 123.1)로 생성 — 명도가 고르게 벌어진다(ΔL 0.085).
          lime: {
            50: { value: "#f6fee8" },
            100: { value: "#e4fdb2" },
            200: { value: "#ccff00" },
            300: { value: "#b3e100" },
            400: { value: "#9bc300" },
            500: { value: "#83a600" },
            600: { value: "#6d8a00" },
            700: { value: "#577000" },
            800: { value: "#425600" },
            900: { value: "#2f3d03" },
            950: { value: "#222c02" },
          },

          // Tailwind neutral.
          gray: {
            50: { value: "#fafafa" },
            100: { value: "#f5f5f5" },
            200: { value: "#e5e5e5" },
            300: { value: "#d4d4d4" },
            400: { value: "#a3a3a3" },
            500: { value: "#737373" },
            600: { value: "#525252" },
            700: { value: "#404040" },
            800: { value: "#262626" },
            900: { value: "#171717" },
            950: { value: "#0a0a0a" },
          },
        },

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

      // 다이얼로그 진입 — 상태 변화를 설명하는 모션만 둔다(→ DESIGN.md 모션).
      keyframes: {
        dialogIn: {
          from: { opacity: "0", transform: "translateY(6px) scale(0.99)" },
        },
      },

      // 시맨틱 토큰 — "이 자리에 쓰는 의미". 라이트=base, 다크=_dark로 매핑.
      // 어느 표면이 어느 토큰을 쓰는지는 DESIGN.md의 표면 표가 단일 출처다.
      semanticTokens: {
        colors: {
          bg: {
            // 창 바닥 — `_glass` 조건을 갖는 **유일한 토큰**이다. 유리 유무로 갈리는 CSS를
            // 여기 하나로 묶어 컴포넌트가 플랫폼을 모르게 한다(→ decisions/glass).
            canvas: {
              value: {
                base: "{colors.gray.100}",
                _dark: "{colors.gray.950}",
                _glass: "transparent",
              },
            },

            // 유리 위에 얹는 틴트 — 순백/순흑에 알파만 얹는다. 창 뒤를 흐리는 것은 OS의 일이다
            // (→ src-tauri/src/window_glass.rs). 설정이 알파를 덮어쓰며, 하한은 없다(→ decisions/glass).
            chrome: {
              value: {
                base: `rgba(255, 255, 255, var(--norii-glass-opacity, ${GLASS_OPACITY_DEFAULT.light}))`,
                _dark: `rgba(0, 0, 0, var(--norii-glass-opacity, ${GLASS_OPACITY_DEFAULT.dark}))`,
              },
            },

            // 글이 놓이는 면. 항상 불투명 — 편집면·프리뷰면·활성 탭이 공유한다.
            // 캔버스보다 한 단계 밝아 종이가 위로 떠 보인다.
            paper: { value: { base: "{colors.gray.50}", _dark: "{colors.gray.900}" } },

            // 상태 배경(호버·활성 줄). 캔버스와 분리한다 — 캔버스를 참조하면 유리에서 피드백이 사라진다.
            // **선택 영역에는 쓰지 않는다** — 활성 줄과 같은 색이면 커서가 있는 줄에서 선택이 사라진다.
            hover: {
              value: { base: "rgba(23, 23, 23, 0.06)", _dark: "rgba(250, 250, 250, 0.08)" },
            },

            // 사용자가 **고른** 것 — 텍스트 선택, 그리고 검색 결과 중 지금 보고 있는 하나.
            // 활성 줄(hover) 위에 겹쳐도 보여야 하므로 알파가 그보다 훨씬 높고, 액센트 색을 써서
            // 무채색 상태 배경들과 성격이 갈린다.
            selection: {
              value: { base: "rgba(204, 255, 0, 0.28)", _dark: "rgba(204, 255, 0, 0.30)" },
            },

            // 시스템이 **찾은** 것 — 검색 결과·같은 낱말·괄호 짝. 고른 것보다 물러난다.
            match: {
              value: { base: "rgba(204, 255, 0, 0.14)", _dark: "rgba(204, 255, 0, 0.16)" },
            },

            // 스크롤바
            scrollbar: {
              value: { base: "rgba(23, 23, 23, 0.25)", _dark: "rgba(250, 250, 250, 0.25)" },
            },
            scrollbarHover: {
              value: { base: "rgba(23, 23, 23, 0.4)", _dark: "rgba(250, 250, 250, 0.4)" },
            },

            // 오버레이 뒤를 가리는 딤. 다크에서는 표면 대비가 낮아 더 짙게 깐다.
            scrim: { value: { base: "rgba(0, 0, 0, 0.4)", _dark: "rgba(0, 0, 0, 0.6)" } },
          },

          text: {
            // 종이 위에서도 유리 위에서도 이 색을 쓴다.
            DEFAULT: { value: { base: "{colors.gray.900}", _dark: "{colors.gray.200}" } },
            // 흐린 글자 — 종이 위에서만 쓴다(→ decisions/color-palette).
            muted: { value: { base: "{colors.gray.700}", _dark: "{colors.gray.400}" } },
            // 마크다운 구문 마크(#, -, **, 링크 등)의 색. 액센트와 달리 테마별로 값이 갈린다.
            mark: { value: { base: "{colors.lime.700}", _dark: "{colors.lime.300}" } },
          },

          // 쓰는 자리와 금지되는 자리는 decisions/color-palette가 소유한다.
          accent: {
            DEFAULT: { value: "{colors.lime.200}" },
            fg: { value: "{colors.gray.900}" },
            hover: { value: "#baeb00" },
            pressed: { value: "#a6d400" },
          },

          status: {
            info: { value: "#008feb" },
            emphasis: { value: "#7b68f3" },
            success: { value: "#00a72c" },
            warning: { value: "#d17d00" },
            danger: { value: "#e44339" },
            // 쓰는 자리와 근거는 decisions/color-palette 상태색이 소유한다.
            dangerSurface: { value: "#cc3329" },
            dangerFg: { value: "#ffffff" },
          },

          border: {
            DEFAULT: {
              value: { base: "rgba(23, 23, 23, 0.14)", _dark: "rgba(250, 250, 250, 0.14)" },
            },
            // 더 연한 경계선 — 트리 세로 가이드 등 옅게 두는 선.
            muted: {
              value: { base: "rgba(23, 23, 23, 0.2)", _dark: "rgba(250, 250, 250, 0.2)" },
            },
          },
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
    // 손잡이 둘레의 여백은 투명 테두리로 만든다 — 배경을 content-box까지만 칠한다.
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
