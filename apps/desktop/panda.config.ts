import { defineConfig } from "@pandacss/dev";

// 디자인 시스템 토큰·조건의 단일 출처(→ .claude/docs/design/design-system.md).
// 컴포넌트는 시맨틱 토큰만 참조하고, 원시값은 이 파일의 토큰 정의 계층에만 둔다.
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
      // 원시 토큰 — 팔레트·폰트의 실제 값. 시맨틱 토큰이 이걸 참조한다.
      tokens: {
        colors: {
          white: { value: "#ffffff" },
          gray: {
            50: { value: "#f8f9fa" },
            100: { value: "#f1f3f5" },
            200: { value: "#e9ecef" },
            300: { value: "#dee2e6" },
            400: { value: "#ced4da" },
            500: { value: "#adb5bd" },
            600: { value: "#868e96" },
            700: { value: "#495057" },
            800: { value: "#343a40" },
            900: { value: "#212529" },
            950: { value: "#141618" },
          },
          accent: {
            400: { value: "#4dabf7" },
            500: { value: "#228be6" },
            600: { value: "#1c7ed6" },
          },
        },
        fonts: {
          body: {
            value:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
          },
          mono: {
            value: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
          },
        },
      },

      // 시맨틱 토큰 — "이 자리에 쓰는 의미". 라이트=base, 다크=_dark로 매핑.
      semanticTokens: {
        colors: {
          bg: {
            canvas: { value: { base: "{colors.gray.50}", _dark: "{colors.gray.950}" } },
            surface: { value: { base: "{colors.white}", _dark: "{colors.gray.900}" } },
            // 모달 뒤 딤 오버레이 — 다크에서는 표면 대비가 낮아 더 짙게 깔아 구분한다.
            overlay: { value: { base: "rgba(0, 0, 0, 0.4)", _dark: "rgba(0, 0, 0, 0.6)" } },
          },
          text: {
            DEFAULT: { value: { base: "{colors.gray.900}", _dark: "{colors.gray.100}" } },
            muted: { value: { base: "{colors.gray.600}", _dark: "{colors.gray.500}" } },
          },
          border: { value: { base: "{colors.gray.200}", _dark: "{colors.gray.800}" } },
          accent: { value: { base: "{colors.accent.600}", _dark: "{colors.accent.400}" } },
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
      fontFamily: "body",
    },
  },

  // 생성물 위치 — VCS 제외(→ .claude/docs/project-structure.md).
  outdir: "styled-system",
});
