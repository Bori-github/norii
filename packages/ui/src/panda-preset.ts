import { definePreset } from "@pandacss/dev";

// 디자인 시스템 색 토큰의 단일 출처(→ .claude/docs/design/design-system.md).
// 컴포넌트는 시맨틱 토큰만 참조하고, 원시값은 이 파일의 토큰 정의 계층에만 둔다.
//
// 색 값은 대비 게이트를 통과한 것만 들어온다(apps/desktop/src/shared/config/design-tokens.test.ts).
// 특히 bg.chrome의 알파는 취향이 아니라 계산 결과다 — 낮추면 유리가 더 투명해지지만
// 밝은 바탕화면 위에서 크롬 글자가 먼저 안 읽히게 되어 테스트가 막는다.

export interface GlassOpacity {
  readonly light: number;
  readonly dark: number;
}

export interface NoriiPresetOptions {
  /** `bg.chrome`이 쓰는 기본 알파. 앱의 `shared/config/glass.ts`가 소유한다. */
  readonly glassOpacity: GlassOpacity;
}

export function createNoriiPreset({ glassOpacity }: NoriiPresetOptions) {
  return definePreset({
    name: "@norii/ui",

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
              // 한 단계(ΔL 0.085)를 건너뛰면 hover·pressed가 너무 어두워진다.
              250: { value: "#baeb00" },
              300: { value: "#b3e100" },
              350: { value: "#a6d400" },
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
                  base: `rgba(255, 255, 255, var(--norii-glass-opacity, ${glassOpacity.light}))`,
                  _dark: `rgba(0, 0, 0, var(--norii-glass-opacity, ${glassOpacity.dark}))`,
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
              hover: { value: "{colors.lime.250}" },
              pressed: { value: "{colors.lime.350}" },
            },

            status: {
              info: { value: "#008feb" },
              emphasis: { value: "#7b68f3" },
              success: { value: "#00a72c" },
              warning: { value: "#d17d00" },
              danger: { value: "#e44339" },
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
      },
    },
  });
}
