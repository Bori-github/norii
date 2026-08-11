import type { Decorator, Preview } from "@storybook/react-vite";
import { ThemeProvider, ensure, themes } from "storybook/theming";

import "./preview.css";

// 테마는 루트 속성으로 갈리기 때문에 툴바에서 그 속성을 바꾼다.
// ColorPalette·IconGallery 같은 Doc Block은 Storybook 테마를 읽는데 Canvas에는 그 컨텍스트가
// 없기 때문에(Docs에만 있음) 여기서 넣는다 — 없으면 블록이 렌더 중 예외를 던진다.
const withSurface: Decorator = (Story, context) => {
  const dark = context.globals["theme"] === "dark";
  document.documentElement.dataset["theme"] = dark ? "dark" : "light";

  return (
    <ThemeProvider theme={ensure(dark ? themes.dark : themes.light)}>
      <div style={{ color: "var(--colors-text)", fontFamily: "var(--fonts-ui)" }}>
        <Story />
      </div>
    </ThemeProvider>
  );
};

const preview: Preview = {
  parameters: {
    layout: "padded",

    // 배경을 토큰으로 두면 컴포넌트를 앱에서 실제로 놓이는 면 위에서 본다.
    // var()로 적어 테마 툴바를 따라간다.
    backgrounds: {
      options: {
        canvas: { name: "bg.canvas — 편집 면", value: "var(--colors-bg-canvas)" },
        chrome: { name: "bg.chrome — 사이드바·탭바", value: "var(--colors-bg-chrome)" },
        paper: { name: "bg.paper — 다이얼로그·팝오버", value: "var(--colors-bg-paper)" },
      },
    },

    // 기본 프리셋은 휴대폰 크기라 데스크톱 앱에 쓸 데가 없음. 네 값은 앱에서 컴포넌트가
    // 실제로 놓이는 칸의 폭 — 좁은 쪽부터 분할 한 칸 · 사이드바 · 문서 칸 · 창 전체.
    viewport: {
      options: {
        pane: { name: "분할 한 칸 200px", styles: { width: "200px", height: "768px" } },
        sidebar: { name: "사이드바 240px", styles: { width: "240px", height: "768px" } },
        document: { name: "문서 칸 400px", styles: { width: "400px", height: "768px" } },
        window: { name: "창 기본 1024px", styles: { width: "1024px", height: "768px" } },
      },
    },

    options: {
      storySort: { order: ["Tokens", "Icons", "*"] },
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
