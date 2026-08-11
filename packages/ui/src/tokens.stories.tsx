import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";

import { Cell, Row, Section } from "../.storybook/grid";

import { GLASS_OPACITY_DEFAULT } from "./panda-preset";

const meta = {
  title: "Tokens",
  tags: ["autodocs"],
  parameters: { controls: { disable: true } },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

function Swatch({ token, note }: { token: string; note?: string }) {
  return (
    <Cell label={note ? `${token} · ${note}` : token}>
      <div
        style={{
          width: 132,
          height: 56,
          borderRadius: 4,
          background: `var(--colors-${token.replaceAll(".", "-")})`,
          border: "1px solid var(--colors-border)",
        }}
      />
    </Cell>
  );
}

// 앱 설정의 불투명도 슬라이더와 같은 범위다(min 0 · max 1 · step 0.01).
// 이 값은 --norii-glass-opacity로 들어가고 bg.chrome만 바꾼다.
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

// bg.chrome은 이 패키지의 컴포넌트가 쓰지 않는다 — 앱의 크롬(타이틀바·사이드바·탭바)이 쓴다.
// 슬라이더의 효과를 보려면 그 토큰을 직접 칠한 면이 필요하므로 여기서 만든다.
export const 표면: Story = {
  render: () => (
    <>
      <OpacitySlider />

      <Section title="bg.chrome — 슬라이더가 바꾸는 유일한 토큰">
        <div
          style={{
            padding: 20,
            borderRadius: 6,
            // 유리가 켜지면 캔버스가 투명해져 뒤가 비치는 것을 보이려고 격자를 깐다.
            backgroundImage:
              "repeating-conic-gradient(rgba(128,128,128,0.25) 0% 25%, transparent 0% 50%)",
            backgroundSize: "16px 16px",
          }}
        >
          <div
            style={{
              padding: 16,
              borderRadius: 4,
              background: "var(--colors-bg-chrome)",
              color: "var(--colors-text)",
            }}
          >
            타이틀 스트립 · 사이드바 · 탭바 · 상태바가 쓰는 면
          </div>
        </div>
      </Section>

      <Section title="bg.canvas — 유리 유무로 갈리는 유일한 토큰">
        <Row>
          <Swatch token="bg.canvas" note="유리 끔" />
          {/* 앱에서는 투명해진 자리를 OS가 창 뒤 바탕화면을 흐려 채운다 — 브라우저에는 그 흐림이 없다. */}
          <div data-glass="on">
            <Swatch token="bg.canvas" note="유리 켬 · 투명" />
          </div>
        </Row>
      </Section>

      <Section title="배경">
        <Row>
          <Swatch token="bg.paper" />
          <Swatch token="bg.hover" />
          <Swatch token="bg.selection" />
          <Swatch token="bg.match" />
          <Swatch token="bg.scrim" />
        </Row>
      </Section>

      <Section title="상태색">
        <Row>
          {["info", "emphasis", "success", "warning", "danger"].map((name) => (
            <Swatch key={name} token={`status.${name}`} />
          ))}
        </Row>
      </Section>
    </>
  ),
};
