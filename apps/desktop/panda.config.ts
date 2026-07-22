import { defineConfig } from "@pandacss/dev";

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
          // 글레이셔 — 브랜드이자 액센트의 색 계열. oklch(L C 223)로 생성해 명도 계단이 고르다.
          // 팔레트를 왜 이렇게 정했는지는 decisions/color-palette가 소유한다.
          glacier: {
            50: { value: "#eafbff" },
            100: { value: "#d1f7ff" },
            200: { value: "#9cf3ff" },
            300: { value: "#63e2ff" },
            400: { value: "#3dc9f4" },
            500: { value: "#00a8d2" },
            600: { value: "#0082a7" },
            700: { value: "#006f90" },
            800: { value: "#00516b" },
            900: { value: "#003a4f" },
            950: { value: "#001f2b" },
          },

          // 무채색 — 글레이셔와 색상각이 다른 것은 의도된 것이다(→ decisions/color-palette).
          gray: {
            50: { value: "#fcfdfe" },
            100: { value: "#f3f7fa" },
            200: { value: "#dce7ee" },
            300: { value: "#bbcad3" },
            400: { value: "#9badb9" },
            500: { value: "#80919d" },
            600: { value: "#677781" },
            700: { value: "#4e5d67" },
            800: { value: "#313e47" },
            900: { value: "#16212a" },
            950: { value: "#101820" },
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
            // (→ src-tauri/src/window_glass.rs). 알파 기본값의 하한과 설정 노출은 decisions/glass가 소유한다.
            chrome: {
              value: {
                base: "rgba(255, 255, 255, var(--norii-glass-opacity, 0.55))",
                _dark: "rgba(0, 0, 0, var(--norii-glass-opacity, 0.62))",
              },
            },

            // 글이 놓이는 면. 항상 불투명 — 편집면·프리뷰면·활성 탭이 공유한다.
            // 캔버스보다 한 단계 밝아 종이가 위로 떠 보인다.
            paper: { value: { base: "{colors.gray.50}", _dark: "{colors.gray.900}" } },

            // 상태 배경(호버·활성 줄). 캔버스와 분리한다 — 캔버스를 참조하면 유리에서 피드백이 사라진다.
            // **선택 영역에는 쓰지 않는다** — 활성 줄과 같은 색이면 커서가 있는 줄에서 선택이 사라진다.
            hover: {
              value: { base: "rgba(22, 33, 42, 0.06)", _dark: "rgba(252, 253, 254, 0.08)" },
            },

            // 사용자가 **고른** 것 — 텍스트 선택, 그리고 검색 결과 중 지금 보고 있는 하나.
            // 활성 줄(hover) 위에 겹쳐도 보여야 하므로 알파가 그보다 훨씬 높고, 액센트 색을 써서
            // 무채색 상태 배경들과 성격이 갈린다.
            selection: {
              value: { base: "rgba(0, 130, 167, 0.28)", _dark: "rgba(99, 226, 255, 0.30)" },
            },

            // 시스템이 **찾은** 것 — 검색 결과·같은 낱말·괄호 짝. 고른 것보다 물러난다.
            match: {
              value: { base: "rgba(0, 130, 167, 0.14)", _dark: "rgba(99, 226, 255, 0.16)" },
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
            mark: { value: { base: "{colors.glacier.700}", _dark: "{colors.glacier.300}" } },
          },

          // 액센트 — 쓰는 자리와 금지되는 자리는 decisions/color-palette가 소유한다.
          accent: { value: "{colors.glacier.600}" },

          // 상태색 — 테마 공통 단일 값이라 원시 층에 두지 않는다. 갈라질 것이 없으면 매핑도 없다.
          status: {
            info: { value: "#7b68f3" },
            success: { value: "#00a72c" },
            warning: { value: "#d17d00" },
            danger: { value: "#e44339" },
          },

          border: { value: { base: "rgba(22, 33, 42, 0.14)", _dark: "rgba(252, 253, 254, 0.14)" } },
        },
      },
    },
  },

  // 앱 전역 표면 — 시맨틱 토큰으로 배경·글자·높이를 잡는다.
  globalCss: {
    "html, body, #root": { height: "100%" },
    body: {
      margin: "0",
      background: "bg.canvas",
      color: "text",
      fontFamily: "ui",
      lineHeight: "ui",
    },
  },

  // 생성물 위치 — VCS 제외(→ .claude/docs/project-structure.md).
  outdir: "styled-system",
});
