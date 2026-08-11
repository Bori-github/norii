import { fileURLToPath } from "node:url";

import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.tsx"],
  framework: { name: "@storybook/react-vite", options: {} },
  addons: ["@storybook/addon-docs"],

  // norii는 local-first라 빌드가 밖으로 아무것도 보내지 않는다.
  core: { disableTelemetry: true },

  typescript: {
    // 기본 react-docgen은 props별 TSDoc을 읽지 못해 Docs의 표가 설명 없이 나온다.
    reactDocgen: "react-docgen-typescript",
    reactDocgenTypescriptOptions: {
      // 상속받은 HTML 속성까지 표에 들어가면 우리가 정한 props가 묻힌다.
      propFilter: (prop) => !prop.parent || !prop.parent.fileName.includes("node_modules"),
    },
  },

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
