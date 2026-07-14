import { playwright } from "@vitest/browser-playwright";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

// 순수 로직(스토어 전이·IPC 정규화·자동 저장 스케줄러)은 환경 의존이 없어 node에서 검증한다.
// 컴포넌트·렌더(*.browser.test.*)는 실제 WebKit(Vitest Browser Mode)에서 검증한다 —
// 에뮬레이션 DOM(happy-dom)은 금지다(→ .claude/docs/testing.md).
// 실제 웹뷰·IPC가 필요한 위험 영역은 실앱 E2E(vitest.e2e.config.ts)가 다룬다.
export default defineConfig({
  // katex는 ESM 빌드로 고정한다 — CJS 빌드가 번들되면 제어 시퀀스가 전부 "정의되지 않음"이
  // 되어 모든 수식이 깨진다. 수식 플러그인이 require("katex")로 CJS를 잡는다
  // (→ .claude/docs/preview-strategy.md#수식-katex).
  // alias는 정확히 "katex"만 갈아치운다 — 접두 매칭이면 katex/dist/katex.min.css 같은
  // 하위 경로까지 망가진다.
  resolve: { alias: [{ find: /^katex$/, replacement: "katex/dist/katex.mjs" }] },
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
          // 브라우저 테스트 파일은 **직렬로** 돈다. 병렬로 돌리면 여러 파일이 동시에 무거운
          // 동적 청크(mermaid는 청크가 100개 가까이 된다)를 받아 오다가 로딩이 간헐적으로
          // 실패한다("Importing a module script failed") — 실측으로 확인했다. 느려지는 대신
          // 결과가 결정적이 된다(E2E 설정과 같은 선택).
          fileParallelism: false,
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
