import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// 스타일 정의(recipe의 변형·토큰 선택)는 DOM 없이 검증한다.
// 렌더 결과는 앱 레이어의 브라우저 모드에서 본다(→ .claude/docs/testing.md).
//
// styled-system은 codegen 산출물이라 tsconfig paths로만 이어져 있다 — Vite는 그것을
// 읽지 않으므로 같은 자리를 별칭으로 다시 알려 준다.
export default defineConfig({
  resolve: {
    alias: {
      "styled-system": fileURLToPath(new URL("./styled-system", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
