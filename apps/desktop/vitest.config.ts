import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

// 순수 로직(스토어 전이·IPC 정규화·자동 저장 스케줄러)은 환경 의존이 없어 node에서 검증한다.
// 실제 웹뷰·IPC가 필요한 위험 영역은 실앱 E2E(vitest.e2e.config.ts)가 다룬다(→ .claude/docs/testing.md).
export default defineConfig({
  plugins: [tsconfigPaths({ projects: ["./tsconfig.app.json"] })],
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
