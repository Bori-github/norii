import { fileURLToPath } from "node:url";

import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

// Vitest는 tsconfig의 paths를 읽지 않기 때문에 별칭으로 지정
const alias = { "styled-system": fileURLToPath(new URL("./styled-system", import.meta.url)) };

// recipe·토큰은 값만 읽으면 되므로 node에서, 스토리는 실제 렌더가 필요하므로 브라우저에서 돈다.
// 브라우저는 앱과 같은 WebKit이다 — 다른 엔진에서 통과한 것은 앱에서 통과한다는 근거가 못 된다.
export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        extends: true,
        plugins: [
          storybookTest({ configDir: fileURLToPath(new URL("./.storybook", import.meta.url)) }),
        ],
        test: {
          name: "storybook",
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
