import { fileURLToPath } from "node:url";

// 두 설정이 각자 별칭을 두면 테스트가 통과한 것이 앱에서 다르게 번들되기 때문에
// vite.config와 vitest.config가 이 목록을 함께 씀
export const RESOLVE_ALIAS = [
  // katex는 ESM 빌드로 고정한다 — CJS 빌드가 번들되면 제어 시퀀스가 전부 "정의되지 않음"이
  // 되어 모든 수식이 깨진다. 수식 플러그인이 require("katex")로 CJS를 잡는다
  // (→ .claude/docs/preview-strategy.md#수식-katex).
  // 정확히 "katex"만 갈아치운다 — 접두 매칭이면 katex/dist/katex.min.css 같은
  // 하위 경로까지 망가진다.
  { find: /^katex$/, replacement: "katex/dist/katex.mjs" },

  // vite-tsconfig-paths는 앱 tsconfig가 포함하는 파일에만 적용되기 때문에
  // @norii/ui 소스의 styled-system import를 여기서 해석
  {
    find: /^styled-system(?=\/|$)/,
    replacement: fileURLToPath(new URL("./styled-system", import.meta.url)),
  },
];
