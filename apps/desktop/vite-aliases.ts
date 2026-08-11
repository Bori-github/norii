import { fileURLToPath } from "node:url";

// vite.config와 vitest.config가 같은 해석 규칙을 쓴다 — 갈라지면 테스트가 통과한 것이
// 앱에서 다르게 번들된다.
export const RESOLVE_ALIAS = [
  // katex는 ESM 빌드로 고정한다 — CJS 빌드가 번들되면 제어 시퀀스가 전부 "정의되지 않음"이
  // 되어 모든 수식이 깨진다. 수식 플러그인이 require("katex")로 CJS를 잡는다
  // (→ .claude/docs/preview-strategy.md#수식-katex).
  // 정확히 "katex"만 갈아치운다 — 접두 매칭이면 katex/dist/katex.min.css 같은
  // 하위 경로까지 망가진다.
  { find: /^katex$/, replacement: "katex/dist/katex.mjs" },

  // @norii/ui의 컴포넌트도 앱의 생성물을 쓰게 한다. vite-tsconfig-paths는 앱 tsconfig가
  // 포함하는 파일에만 적용돼 패키지 소스의 같은 import를 풀지 못한다.
  {
    find: /^styled-system(?=\/|$)/,
    replacement: fileURLToPath(new URL("./styled-system", import.meta.url)),
  },
];
