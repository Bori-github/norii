import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";

import { Section } from "../.storybook/grid";

import { GLASS_OPACITY_DEFAULT } from "./panda-preset";

const meta = {
  title: "Foundations/Glass",
  tags: ["autodocs"],
  parameters: {
    controls: { disable: true },
    // component가 없어 docgen이 읽을 곳이 없기 때문에 여기서 설명을 준다.
    docs: { description: { component: "유리 불투명도가 어느 토큰을 바꾸는지" } },
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

// bg.chrome을 이 패키지의 컴포넌트가 쓰지 않기 때문에 그 토큰을 직접 칠한 면을 만듦
export const Opacity: Story = {
  render: () => (
    <>
      <OpacitySlider />

      <Section title="bg.chrome">
        <div style={CHECKER}>
          <div style={{ padding: 16, borderRadius: 4, background: "var(--colors-bg-chrome)" }}>
            타이틀 스트립 · 사이드바 · 탭바 · 상태바가 쓰는 면
          </div>
        </div>
      </Section>

      <Section title="bg.canvas">
        {/* 투명해진 자리를 앱에서는 OS가 창 뒤를 흐려 채우지만 브라우저에는 그 흐림이 없음 */}
        <div data-glass="on" style={CHECKER}>
          <div style={{ padding: 16, borderRadius: 4, background: "var(--colors-bg-canvas)" }}>
            유리를 켜면 이 면이 투명해진다
          </div>
        </div>
      </Section>
    </>
  ),
};
