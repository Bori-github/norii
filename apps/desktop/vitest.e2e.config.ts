import { defineConfig } from "vitest/config";

// 실앱 E2E 설정 — 실제 Tauri 앱에 WebDriver로 붙으므로 느리고, 앱이 떠 있어야 한다.
// 빠른 `test` 게이트와 분리해 CI(및 필요 시 로컬)에서만 돈다(→ .claude/docs/testing.md).
// 환경은 node(기본) — webdriverio가 node에서 HTTP로 임베디드 서버에 연결한다.
export default defineConfig({
  test: {
    include: ["e2e/**/*.e2e.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
