import { defineConfig } from "@pandacss/dev";
import pandaPreset from "@pandacss/dev/presets";

import { createNoriiPreset, GLASS_OPACITY_DEFAULT } from "./src/panda-preset";
import { OMITTED_SCALE_PATHS } from "./src/panda-scale";

export default defineConfig({
  presets: [pandaPreset, createNoriiPreset({ glassOpacity: GLASS_OPACITY_DEFAULT })],

  include: ["./src/**/*.{ts,tsx}"],
  exclude: [],

  hooks: {
    "config:resolved": ({ config, utils }) =>
      utils.omit(config, OMITTED_SCALE_PATHS) as typeof config,
  },

  outdir: "styled-system",
});
