import type { Decorator, Preview } from "@storybook/react-vite";

import "./preview.css";

// 테마는 루트 속성으로 갈리기 때문에 툴바에서 그 속성을 바꾼다.
const withSurface: Decorator = (Story, context) => {
  document.documentElement.dataset["theme"] = String(context.globals["theme"]);

  return (
    <div
      style={{
        background: "var(--colors-bg-canvas)",
        color: "var(--colors-text)",
        fontFamily: "var(--fonts-ui)",
        padding: "24px",
      }}
    >
      <Story />
    </div>
  );
};

const preview: Preview = {
  globalTypes: {
    theme: {
      description: "data-theme",
      toolbar: {
        icon: "circlehollow",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
      },
    },
  },
  initialGlobals: { theme: "light" },
  decorators: [withSurface],
};

export default preview;
