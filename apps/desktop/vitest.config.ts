import { playwright } from "@vitest/browser-playwright";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

// 순수 로직(스토어 전이·IPC 정규화·자동 저장 스케줄러)은 환경 의존이 없어 node에서 검증한다.
// 컴포넌트·렌더(*.browser.test.*)는 실제 WebKit(Vitest Browser Mode)에서 검증한다 —
// 에뮬레이션 DOM(happy-dom)은 금지다(→ .claude/docs/testing.md).
// 실제 웹뷰·IPC가 필요한 위험 영역은 실앱 E2E(vitest.e2e.config.ts)가 다룬다.
export default defineConfig({
  plugins: [tsconfigPaths({ projects: ["./tsconfig.app.json"] })],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: ["src/**/*.browser.test.{ts,tsx}"],
        },
      },
      {
        extends: true,
        test: {
          name: "browser",
          include: ["src/**/*.browser.test.{ts,tsx}"],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "webkit" }],
          },
        },
      },
    ],
  },
});
