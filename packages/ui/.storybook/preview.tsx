import { DocsContainer } from "@storybook/addon-docs/blocks";
import type { DocsContainerProps } from "@storybook/addon-docs/blocks";
import type { Decorator, Preview } from "@storybook/react-vite";
import type { PropsWithChildren } from "react";

import "./preview.css";

const withSurface: Decorator = (Story, context) => {
  const theme = String(context.globals["theme"]);

  // 배경 툴바가 루트에서 토큰을 읽기 때문에 캔버스에서만 루트에 건다.
  if (context.viewMode !== "docs") document.documentElement.dataset["theme"] = theme;

  return (
    <div data-theme={theme} style={{ color: "var(--colors-text)", fontFamily: "var(--fonts-ui)" }}>
      <Story />
    </div>
  );
};

// 문서 화면은 Storybook 자신의 밝은 테마라 다크가 남으면 글자가 묻힌다. 스토리가 없는
// 페이지에는 데코레이터가 돌지 않아 직전 테마가 루트에 남는다.
const DocsSurface = ({ children, context }: PropsWithChildren<DocsContainerProps>) => {
  delete document.documentElement.dataset["theme"];

  return <DocsContainer context={context}>{children}</DocsContainer>;
};

const preview: Preview = {
  parameters: {
    layout: "padded",

    docs: { container: DocsSurface },

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
