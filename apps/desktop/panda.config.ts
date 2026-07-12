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
          white: { value: "#ffffff" },

          // 액센트. 다크는 50이 형광 그대로 빛나고, 라이트는 300이 올리브로 내려앉는다
          // — 흰 종이 위 형광 라임은 1.21:1이라 물리적으로 쓸 수 없다(→ decisions/0004).
          lime: {
            50: { value: "#cafb41" },
            100: { value: "#a7d034" },
            200: { value: "#85a728" },
            300: { value: "#657f1c" },
            400: { value: "#475a11" },
            500: { value: "#2a3707" },
            600: { value: "#111802" },
          },

          // 브랜드 전용 — 앱 UI에 쓰지 않으므로 시맨틱 토큰을 갖지 않는다.
          // 유리 위 라이트 테마에서 1.32:1이라 어떤 알파로도 접근성 기준을 통과하지 못한다.
          violet: {
            50: { value: "#ddd7fe" },
            100: { value: "#b7a9fd" },
            200: { value: "#9379fc" },
            300: { value: "#7241fb" },
            400: { value: "#500bce" },
            500: { value: "#2e047d" },
            600: { value: "#140141" },
          },

          neutral: {
            50: { value: "#dcdbdd" },
            100: { value: "#b4b4b8" },
            200: { value: "#8e8d94" },
            300: { value: "#6a6971" },
            400: { value: "#48474e" },
            500: { value: "#28282c" },
            600: { value: "#111113" },
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
            canvas: { value: { base: "{colors.neutral.50}", _dark: "{colors.neutral.600}" } },

            // 유리 위에 얹는 틴트. 알파는 대비 게이트가 정한 하한이다
            // — 라이트 0.485(바탕 52% 비침) · 다크 0.67(33% 비침).
            chrome: {
              value: { base: "rgba(255, 255, 255, 0.485)", _dark: "rgba(17, 17, 19, 0.67)" },
            },

            // 글이 놓이는 면. 항상 불투명 — 편집면·프리뷰면·활성 탭이 공유한다.
            paper: { value: { base: "{colors.white}", _dark: "{colors.neutral.600}" } },

            // 상태 배경(호버·선택). 캔버스와 분리한다 — 캔버스를 참조하면 유리에서 피드백이 사라진다.
            hover: {
              value: { base: "rgba(17, 17, 19, 0.06)", _dark: "rgba(220, 219, 221, 0.08)" },
            },

            // 오버레이 뒤를 가리는 딤. 다크에서는 표면 대비가 낮아 더 짙게 깐다.
            scrim: { value: { base: "rgba(0, 0, 0, 0.4)", _dark: "rgba(0, 0, 0, 0.6)" } },
          },

          text: {
            // 종이 위에서도 유리 위에서도 이 색을 쓴다.
            DEFAULT: { value: { base: "{colors.neutral.600}", _dark: "{colors.neutral.50}" } },
            // 흐린 글자 — 종이 위에서만. 크롬에 쓰면 유리 알파가 0.83+로 치솟는다(→ decisions/0004).
            muted: { value: { base: "{colors.neutral.300}", _dark: "{colors.neutral.200}" } },
          },

          // 액센트 — 종이 위에서만. 살아 있는 것(커서·활성 탭의 dirty ●·본문 마크업)에만 쓴다.
          accent: { value: { base: "{colors.lime.300}", _dark: "{colors.lime.50}" } },

          border: { value: { base: "rgba(17, 17, 19, 0.12)", _dark: "rgba(220, 219, 221, 0.12)" } },
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
