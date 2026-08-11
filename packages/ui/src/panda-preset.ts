import { definePreset } from "@pandacss/dev";

export interface GlassOpacity {
  readonly light: number;
  readonly dark: number;
}

export const GLASS_OPACITY_DEFAULT: GlassOpacity = { light: 0.5, dark: 0.6 };

export interface NoriiPresetOptions {
  readonly glassOpacity: GlassOpacity;
}

/**
 * norii 디자인 시스템 토큰을 담은 Panda preset을 만드는 함수
 *
 * @param glassOpacity - `bg.chrome`이 쓰는 크롬 틴트의 알파. 기본값은 `GLASS_OPACITY_DEFAULT`
 *
 * @returns 앱의 `panda.config`가 `presets`에 넣는 preset 객체
 *
 * @description
 * 원시 색·시맨틱 색·타이포·모서리 토큰과 테마 조건(`dark`·`glass`), 포커스 링 layerStyle을 담음
 *
 * 폰트 토큰은 이름만 지정 — woff2와 `@font-face`는 앱이 제공하고, 없으면 시스템 폰트로 폴백
 */
export function createNoriiPreset({ glassOpacity }: NoriiPresetOptions) {
  return definePreset({
    name: "@norii/ui",

    // prefers-color-scheme으로는 앱이 테마를 덮어쓸 수 없기 때문에 루트 속성으로 판정
    conditions: {
      extend: {
        dark: '[data-theme="dark"] &',
        // specificity가 같아 뒤에 정의한 쪽이 적용되기 때문에 dark 뒤에 배치 —
        // 앞에 두면 유리에서 캔버스가 불투명해지고 게이트가 못 잡음
        glass: '[data-glass="on"] &',
      },
    },

    theme: {
      extend: {
        tokens: {
          colors: {
            lime: {
              50: { value: "#f6fee8" },
              100: { value: "#e4fdb2" },
              200: { value: "#ccff00" },
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
            ui: {
              value:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
            },
            editor: {
              value:
                '"Geist Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
            },
            prose: {
              value:
                '"Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
            },
          },

          fontSizes: {
            prose: {
              h1: { value: "2em" },
              h2: { value: "1.5em" },
              h3: { value: "1.25em" },
              h4: { value: "1em" },
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

        semanticTokens: {
          colors: {
            bg: {
              canvas: {
                value: {
                  base: "{colors.gray.100}",
                  _dark: "{colors.gray.950}",
                  _glass: "transparent",
                },
              },

              chrome: {
                value: {
                  base: `rgba(255, 255, 255, var(--norii-glass-opacity, ${glassOpacity.light}))`,
                  _dark: `rgba(0, 0, 0, var(--norii-glass-opacity, ${glassOpacity.dark}))`,
                },
              },

              paper: { value: { base: "{colors.gray.50}", _dark: "{colors.gray.900}" } },

              hover: {
                value: { base: "rgba(23, 23, 23, 0.06)", _dark: "rgba(250, 250, 250, 0.08)" },
              },

              selection: {
                value: { base: "rgba(204, 255, 0, 0.28)", _dark: "rgba(204, 255, 0, 0.30)" },
              },

              match: {
                value: { base: "rgba(204, 255, 0, 0.14)", _dark: "rgba(204, 255, 0, 0.16)" },
              },

              scrollbar: {
                value: { base: "rgba(23, 23, 23, 0.25)", _dark: "rgba(250, 250, 250, 0.25)" },
              },
              scrollbarHover: {
                value: { base: "rgba(23, 23, 23, 0.4)", _dark: "rgba(250, 250, 250, 0.4)" },
              },

              scrim: { value: { base: "rgba(0, 0, 0, 0.4)", _dark: "rgba(0, 0, 0, 0.6)" } },
            },

            text: {
              DEFAULT: { value: { base: "{colors.gray.900}", _dark: "{colors.gray.200}" } },
              muted: { value: { base: "{colors.gray.700}", _dark: "{colors.gray.400}" } },
              mark: { value: { base: "{colors.lime.700}", _dark: "{colors.lime.300}" } },
            },

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
              muted: {
                value: { base: "rgba(23, 23, 23, 0.2)", _dark: "rgba(250, 250, 250, 0.2)" },
              },
            },
          },
        },

        layerStyles: {
          focusOutside: {
            value: {
              _focusVisible: { outline: "2px solid", outlineColor: "text", outlineOffset: "2px" },
            },
          },
          focusInside: {
            value: {
              _focusVisible: { outline: "2px solid", outlineColor: "text", outlineOffset: "-2px" },
            },
          },
        },
      },
    },
  });
}
