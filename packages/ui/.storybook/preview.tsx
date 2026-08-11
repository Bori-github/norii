import type { Decorator, Preview } from "@storybook/react-vite";

import "./preview.css";

const withSurface: Decorator = (Story, context) => {
  document.documentElement.dataset["theme"] = String(context.globals["theme"]);

  return (
    <div style={{ color: "var(--colors-text)", fontFamily: "var(--fonts-ui)" }}>
      <Story />
    </div>
  );
};

const preview: Preview = {
  parameters: {
    layout: "padded",

    // var()로 적어야 테마 툴바를 따라간다.
    backgrounds: {
      options: {
        canvas: { name: "bg.canvas — 편집 면", value: "var(--colors-bg-canvas)" },
        chrome: { name: "bg.chrome — 사이드바·탭바", value: "var(--colors-bg-chrome)" },
        paper: { name: "bg.paper — 다이얼로그·팝오버", value: "var(--colors-bg-paper)" },
      },
    },

    // 기본 프리셋은 휴대폰 크기라 데스크톱 앱에 쓸 데가 없다. 앱에서 컴포넌트가 놓이는 칸의 폭.
    viewport: {
      options: {
        pane: { name: "분할 한 칸 200px", styles: { width: "200px", height: "768px" } },
        sidebar: { name: "사이드바 240px", styles: { width: "240px", height: "768px" } },
        document: { name: "문서 칸 400px", styles: { width: "400px", height: "768px" } },
        window: { name: "창 기본 1024px", styles: { width: "1024px", height: "768px" } },
      },
    },

    options: {
      // Foundations는 Colors를 첫 장으로 두려고 나열하고, 나머지는 늘어나도 손대지 않게 가나다순.
      storySort: {
        method: "alphabetical",
        order: ["Foundations", ["Colors", "Glass", "Icons"], "Components"],
      },
    },
  },

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
  initialGlobals: {
    theme: "light",
    backgrounds: { value: "canvas" },
  },
  decorators: [withSurface],
};

export default preview;
