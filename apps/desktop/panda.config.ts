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

  // 다크 테마는 루트의 data-theme 속성으로 켠다(상태 소유는 app 레이어 Zustand — M5 switch-theme).
  // 기본 _dark(prefers-color-scheme 미디어) 대신 속성 기반으로 바꿔 앱이 테마를 완전히 제어한다.
  conditions: {
    extend: {
      dark: '[data-theme="dark"] &',
    },
  },

  theme: {
    extend: {
      // 원시 토큰 — 팔레트의 실제 값. 시맨틱 토큰이 이걸 참조한다.
      tokens: {
        colors: {
          // 세이지 — 브랜드이자 액센트의 색 계열. oklch(L C 134)로 생성해 명도 계단이 고르다.
          // 액센트로 쓸 수 있는 단계는 600 하나뿐이다 — 그보다 밝으면 라이트 종이에서 안 보이고,
          // 어두우면 다크 종이에서 안 보인다(→ decisions/0006).
          sage: {
            50: { value: "#f2fbed" },
            100: { value: "#e4f7d9" },
            200: { value: "#cbf3b3" },
            300: { value: "#aee38d" },
            400: { value: "#91cb6b" },
            500: { value: "#74aa4d" },
            600: { value: "#568335" },
            700: { value: "#48702a" },
            800: { value: "#32521b" },
            900: { value: "#223b0f" },
            950: { value: "#101f06" },
          },

          // 무채색 — 순수 회색이 아니라 **세이지 쪽으로 미세하게 편향**된 중립이다
          // (같은 색상각 134°, 채도만 0.008). 세이지 종이 위에서 순수 회색은 톤이 어긋나 보인다.
          // 명도 계단은 세이지와 같아 두 스케일을 섞어 써도 층이 맞는다.
          gray: {
            50: { value: "#f5f9f3" },
            100: { value: "#eef1ec" },
            200: { value: "#e2e6e0" },
            300: { value: "#cfd2cd" },
            400: { value: "#b5b8b3" },
            500: { value: "#969994" },
            600: { value: "#727571" },
            700: { value: "#616460" },
            800: { value: "#464944" },
            900: { value: "#313430" },
            950: { value: "#191b18" },
          },
        },

        fonts: {
          // 이름은 역할로 짓는다 — "본문"이 UI 산문인지 에디터 텍스트인지 가리지 못하는 이름은 쓰지 않는다.
          ui: {
            value:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
          },
          // 열 정렬이 의미를 갖는 구간(코드블록·표·들여쓰기)을 위한 고정폭.
          // 한글은 이 스택에 글리프가 없어 비례폭으로 폴백되며, 그건 의도된 것이다(→ DESIGN.md 타이포).
          editor: {
            value: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
          },
        },
      },

      // 시맨틱 토큰 — "이 자리에 쓰는 의미". 라이트=base, 다크=_dark로 매핑.
      // 어느 표면이 어느 토큰을 쓰는지는 DESIGN.md의 표면 표가 단일 출처다.
      semanticTokens: {
        colors: {
          bg: {
            // 창 바닥. M5에서 유리가 켜지면 macOS에서 투명이 된다(→ design/window-chrome.md).
            canvas: { value: { base: "{colors.gray.100}", _dark: "{colors.gray.950}" } },

            // 유리 위에 얹는 틴트. 알파는 대비 게이트가 정한 하한이다
            // — 라이트 0.525(바탕 48% 비침) · 다크 0.64(36% 비침).
            chrome: {
              value: { base: "rgba(245, 249, 243, 0.525)", _dark: "rgba(25, 27, 24, 0.64)" },
            },

            // 글이 놓이는 면. 항상 불투명 — 편집면·프리뷰면·활성 탭이 공유한다.
            // 종이는 **세이지로 물들이지 않는다** — 육안으로는 흰색/검정이되 세이지와 같은 색상각을 갖는
            // 편향 무채색이다. 문서에 붙는 이미지(대개 흰 배경)와 부딪히지 않게 하려는 결정이다(→ decisions/0006).
            paper: { value: { base: "{colors.gray.50}", _dark: "{colors.gray.950}" } },

            // 상태 배경(호버·선택). 캔버스와 분리한다 — 캔버스를 참조하면 유리에서 피드백이 사라진다.
            hover: {
              value: { base: "rgba(25, 27, 24, 0.06)", _dark: "rgba(238, 241, 236, 0.08)" },
            },

            // 오버레이 뒤를 가리는 딤. 다크에서는 표면 대비가 낮아 더 짙게 깐다.
            scrim: { value: { base: "rgba(0, 0, 0, 0.4)", _dark: "rgba(0, 0, 0, 0.6)" } },
          },

          text: {
            // 종이 위에서도 유리 위에서도 이 색을 쓴다. 무채색이되 세이지 쪽으로 미세 편향돼 있다.
            DEFAULT: { value: { base: "{colors.gray.950}", _dark: "{colors.gray.100}" } },
            // 흐린 글자 — 종이 위에서만. 크롬에 쓰면 유리 알파가 치솟는다(→ decisions/0004).
            // 라이트는 700이 하한이다(600은 4.40:1로 AA 미달).
            muted: { value: { base: "{colors.gray.700}", _dark: "{colors.gray.300}" } },
            // 마크다운 구문 마크(#, -, **, 링크 등)의 색. 글자이므로 AA(4.5:1)를 만족해야 하고,
            // 액센트(sage-600)는 다크 종이에서 3.87:1이라 쓸 수 없다 — 그래서 테마별로 단계를 가른다.
            // 액센트와 달리 **글자색 토큰은 갈라도 된다**(→ decisions/0005는 액센트에만 적용).
            mark: { value: { base: "{colors.sage.700}", _dark: "{colors.sage.300}" } },
          },

          // 액센트 — 테마와 무관하게 한 색이고, 글자에는 쓰지 않는다(→ decisions/0005).
          // 세이지 스케일에서 두 종이를 모두 통과하는 단계는 600 하나뿐이다
          // (라이트 종이 4.22:1 · 다크 종이 3.85:1 — 비텍스트 3:1 기준).
          accent: { value: "{colors.sage.600}" },

          border: { value: { base: "rgba(25, 27, 24, 0.14)", _dark: "rgba(238, 241, 236, 0.14)" } },
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
    },
  },

  // 생성물 위치 — VCS 제외(→ .claude/docs/project-structure.md).
  outdir: "styled-system",
});
