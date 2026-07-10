import { defineConfig } from "vitest/config";

// 실앱 E2E 설정 — 실제 Tauri 앱에 WebDriver로 붙으므로 느리고, 앱이 떠 있어야 한다.
// 빠른 `test` 게이트와 분리해 CI(및 필요 시 로컬)에서만 돈다(→ .claude/docs/testing.md).
// 환경은 node(기본) — webdriverio가 node에서 HTTP로 임베디드 서버에 연결한다.
export default defineConfig({
  test: {
    include: ["e2e/**/*.e2e.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // 시나리오는 앱 상태를 공유하고 마지막 시나리오(종료 방어)는 앱을 종료시키므로
    // 파일 병렬 실행을 끈다 — 실행 순서가 파일명(사전순)으로 결정적이어야 한다.
    fileParallelism: false,
  },
});
