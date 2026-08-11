import { ColorItem, ColorPalette } from "@storybook/addon-docs/blocks";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";

import { Section } from "../.storybook/grid";

import { GLASS_OPACITY_DEFAULT } from "./panda-preset";

const meta = {
  title: "Tokens",
  tags: ["autodocs"],
  parameters: {
    controls: { disable: true },
    // component가 없어 docgen이 읽을 곳이 없기 때문에 여기서 설명을 준다 — MCP 목록에도 나온다.
    docs: { description: { component: "면·상태색 토큰과 유리 불투명도" } },
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

// 반투명한 면 뒤가 비치는 것을 보이려면 무늬가 필요하다.
const CHECKER = {
  padding: 20,
  borderRadius: 6,
  backgroundImage: "repeating-conic-gradient(rgba(128,128,128,0.25) 0% 25%, transparent 0% 50%)",
  backgroundSize: "16px 16px",
} as const;

// ColorItem은 색값을 그대로 캡션에 찍기 때문에 var()를 넘기면 변수 이름만 보인다.
// 계산값을 읽어 넘기면 테마별 실제 색이 보이고, 스토리는 테마가 바뀔 때 다시 렌더된다.
function swatches(tokens: string[]) {
  const root = getComputedStyle(document.documentElement);
  return Object.fromEntries(
    tokens.map((token) => [token, root.getPropertyValue(`--colors-${token.replaceAll(".", "-")}`)]),
  );
}

// 앱 설정의 불투명도 슬라이더와 같은 범위이기 때문에 min·max·step을 그 값으로 맞춤
function OpacitySlider() {
  const [opacity, setOpacity] = useState(GLASS_OPACITY_DEFAULT.light);

  useEffect(() => {
    document.documentElement.style.setProperty("--norii-glass-opacity", String(opacity));
    return () => {
      document.documentElement.style.removeProperty("--norii-glass-opacity");
    };
  }, [opacity]);

  return (
    <label style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
      <span style={{ fontSize: 13 }}>유리 불투명도</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={opacity}
        onChange={(event) => setOpacity(Number(event.target.value))}
        style={{ width: 220 }}
      />
      <span style={{ fontSize: 13, fontFamily: "ui-monospace, monospace", minWidth: 44 }}>
        {Math.round(opacity * 100)}%
      </span>
    </label>
  );
}

// bg.chrome은 이 패키지의 컴포넌트가 쓰지 않기 때문에(앱의 타이틀바·사이드바·탭바가 씀)
// 슬라이더의 효과를 보이려고 그 토큰을 직접 칠한 면을 여기서 만듦
export const 표면: Story = {
  render: () => (
    <>
      <OpacitySlider />

      <Section title="bg.chrome — 슬라이더가 바꾸는 유일한 토큰">
        <div style={CHECKER}>
          <div style={{ padding: 16, borderRadius: 4, background: "var(--colors-bg-chrome)" }}>
            타이틀 스트립 · 사이드바 · 탭바 · 상태바가 쓰는 면
          </div>
        </div>
      </Section>

      <Section title="bg.canvas — 유리 유무로 갈리는 유일한 토큰">
        {/* 앱에서는 투명해진 자리를 OS가 창 뒤를 흐려 채우지만 브라우저에는 그 흐림이 없음 — 여기서는 투명까지만 보임 */}
        <div data-glass="on" style={CHECKER}>
          <div style={{ padding: 16, borderRadius: 4, background: "var(--colors-bg-canvas)" }}>
            유리를 켜면 이 면이 투명해진다
          </div>
        </div>
      </Section>

      <ColorPalette>
        <ColorItem
          title="면"
          subtitle="bg.paper 패널·활성 탭 · bg.hover 가리킨 행 · bg.canvas 편집 면"
          colors={swatches(["bg.canvas", "bg.paper", "bg.hover", "bg.chrome"])}
        />
        <ColorItem
          title="표시"
          subtitle="bg.selection 선택한 텍스트 · bg.match 검색 일치 · bg.scrim 다이얼로그 뒤"
          colors={swatches(["bg.selection", "bg.match", "bg.scrim"])}
        />
        <ColorItem
          title="상태색"
          subtitle="배너·상태바가 쓰는 다섯 색"
          colors={swatches([
            "status.info",
            "status.emphasis",
            "status.success",
            "status.warning",
            "status.danger",
          ])}
        />
      </ColorPalette>
    </>
  ),
};
