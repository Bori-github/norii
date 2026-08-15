import { defineConfig } from "@pandacss/dev";
import pandaPreset from "@pandacss/dev/presets";

import { createNoriiPreset, GLASS_OPACITY_DEFAULT } from "./src/panda-preset";
import { OMITTED_SCALE_PATHS } from "./src/panda-scale";

export default defineConfig({
  presets: [pandaPreset, createNoriiPreset({ glassOpacity: GLASS_OPACITY_DEFAULT })],

  include: ["./src/**/*.{ts,tsx}", "./.storybook/**/*.{ts,tsx}"],
  exclude: [],

  // Storybook이 이 패키지의 CSS를 그대로 쓰기 때문에 리셋을 여기서 넣는다.
  preflight: true,

  hooks: {
    "config:resolved": ({ config, utils }) =>
      utils.omit(config, OMITTED_SCALE_PATHS) as typeof config,
  },

  outdir: "styled-system",
});
