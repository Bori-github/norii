import { fileURLToPath } from "node:url";

import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.tsx"],
  framework: { name: "@storybook/react-vite", options: {} },
  addons: ["@storybook/addon-docs"],

  // norii는 local-first라 빌드가 밖으로 아무것도 보내지 않는다.
  core: { disableTelemetry: true },

  viteFinal: (viteConfig) => ({
    ...viteConfig,
    resolve: {
      ...viteConfig.resolve,
      alias: {
        ...viteConfig.resolve?.alias,
        // Vite는 tsconfig의 paths를 읽지 않기 때문에 codegen 산출물 경로를 다시 지정
        "styled-system": fileURLToPath(new URL("../styled-system", import.meta.url)),
      },
    },
  }),
};

export default config;
