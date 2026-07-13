import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

// DOMPurify sanitize는 실제 DOM API를 요구한다. 에뮬레이션 DOM(happy-dom)은 금지이므로
// 이 패키지의 테스트는 Vitest Browser Mode(WebKit)에서 실행한다(→ .claude/docs/testing.md).
export default defineConfig({
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
