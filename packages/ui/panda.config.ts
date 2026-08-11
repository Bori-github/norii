import { defineConfig } from "@pandacss/dev";
import pandaPreset from "@pandacss/dev/presets";

import { createNoriiPreset } from "./src/panda-preset";
import { OMITTED_SCALE_PATHS } from "./src/panda-scale";

// 패키지가 자기 styled-system을 만든다 — 컴포넌트가 css()를 import하므로 홀로 타입체크·빌드가 된다.
// 소비 측은 이 소스를 자기 include에 넣어 같은 규칙을 자기 CSS에 담는다
// (→ .claude/docs/design/design-system.md).
//
// 유리 불투명도 기본값은 소비 측이 정한다. 여기서는 codegen이 토큰을 풀 수 있게만 채운다 —
// 이 값으로 만든 CSS를 앱이 쓰지는 않는다.
export default defineConfig({
  presets: [pandaPreset, createNoriiPreset({ glassOpacity: { light: 0.5, dark: 0.6 } })],

  include: ["./src/**/*.{ts,tsx}"],
  exclude: [],

  // 리셋과 전역 표면은 앱이 깐다.
  preflight: false,

  // preset에 선언한 훅은 실행되지 않는다 — 소비 측 설정에만 둘 수 있다.
  hooks: {
    "config:resolved": ({ config, utils }) =>
      // omit의 반환 타입(Omit<UserConfig, string>)이 훅 시그니처와 안 맞아 원형으로 되돌린다.
      utils.omit(config, OMITTED_SCALE_PATHS) as typeof config,
  },

  outdir: "styled-system",
});
