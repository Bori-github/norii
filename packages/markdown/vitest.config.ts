import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

// DOMPurify sanitize는 실제 DOM API를 요구한다. 에뮬레이션 DOM(happy-dom)은 금지이므로
// 이 패키지의 테스트는 Vitest Browser Mode(WebKit)에서 실행한다(→ .claude/docs/testing.md).
export default defineConfig({
  // katex는 ESM 빌드로 고정한다 — CJS 빌드(dist/katex.js)가 번들되면 제어 시퀀스가 전부
  // "정의되지 않음"이 되어 모든 수식이 깨진다(\frac·\int…). 수식 플러그인이 내부에서
  // require("katex")로 CJS를 잡으므로 여기서 끊는다(→ preview-strategy.md#수식-katex).
  // alias는 정확히 "katex"만 갈아치운다 — 접두 매칭이면 katex/dist/katex.min.css 같은
  // 하위 경로까지 망가진다.
  resolve: { alias: [{ find: /^katex$/, replacement: "katex/dist/katex.mjs" }] },
  test: {
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "webkit" }],
    },
    include: ["src/**/*.test.ts"],
  },
});
