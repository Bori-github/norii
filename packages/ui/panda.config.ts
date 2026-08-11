import { defineConfig } from "@pandacss/dev";
import pandaPreset from "@pandacss/dev/presets";

import { createNoriiPreset, GLASS_OPACITY_DEFAULT } from "./src/panda-preset";
import { OMITTED_SCALE_PATHS } from "./src/panda-scale";

// 패키지가 자기 styled-system을 만든다 — 컴포넌트가 css()를 import하므로 홀로 타입체크·빌드가 된다.
// 소비 측은 이 소스를 자기 include에 넣어 같은 규칙을 자기 CSS에 담는다
// (→ .claude/docs/design/design-system.md).
export default defineConfig({
  presets: [pandaPreset, createNoriiPreset({ glassOpacity: GLASS_OPACITY_DEFAULT })],

  include: ["./src/**/*.{ts,tsx}"],
  exclude: [],

  // 리셋과 전역 표면은 앱이 깐다.
  preflight: false,

  hooks: {
    "config:resolved": ({ config, utils }) =>
      // omit의 반환 타입(Omit<UserConfig, string>)이 훅 시그니처와 안 맞아 원형으로 되돌린다.
      utils.omit(config, OMITTED_SCALE_PATHS) as typeof config,
  },

  outdir: "styled-system",
});
