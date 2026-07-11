import { defineConfig } from "vitest/config";

// 실앱 E2E 설정 — 실제 Tauri 앱에 WebDriver로 붙으므로 느리고, 앱이 떠 있어야 한다.
// 빠른 `test` 게이트와 분리해 CI(및 필요 시 로컬)에서만 돈다(→ .claude/docs/testing.md).
// 환경은 node(기본) — webdriverio가 node에서 HTTP로 임베디드 서버에 연결한다.
export default defineConfig({
  test: {
    include: ["e2e/**/*.e2e.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // 병렬을 꺼도 파일 간 실행 순서는 보장되지 않는다(실측 — 사전순 아님). 따라서 E2E는
    // 한 파일 정책을 유지한다 — 순서 규칙의 단일 출처는 e2e/file-lifecycle.e2e.ts 헤더 주석.
    fileParallelism: false,
  },
});
