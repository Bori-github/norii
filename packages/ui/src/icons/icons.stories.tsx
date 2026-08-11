import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ComponentType, SVGProps } from "react";

import { Cell, Grid, Row, Section } from "../../.storybook/grid";

import * as icons from "./index";

const ENTRIES = Object.entries(icons as Record<string, ComponentType<SVGProps<SVGSVGElement>>>)
  .filter(([name]) => name.endsWith("Icon"))
  .toSorted(([a], [b]) => a.localeCompare(b));

const meta = {
  title: "Icons",
  tags: ["autodocs"],
  parameters: { controls: { disable: true } },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

// 배럴에서 직접 읽기 때문에 아이콘을 더하면 이 화면에 저절로 나온다.
// 라벨은 export 이름 그대로다 — 보고 바로 import에 쓴다.
export const 전체: Story = {
  render: () => (
    <>
      <p style={{ fontSize: 13, marginBottom: 20 }}>
        <code>{'import { CloseIcon } from "@norii/ui/icons";'}</code>
      </p>
      <Grid min={200}>
        {ENTRIES.map(([name, Icon]) => (
          <Cell key={name} label={name}>
            <Icon style={{ width: 24, height: 24 }} />
          </Cell>
        ))}
      </Grid>
    </>
  ),
};

// 크기는 소비 측 CSS가 정한다 — 앱이 실제로 쓰는 세 값이다.
export const 크기: Story = {
  render: () => (
    <>
      {[14, 16, 24].map((size) => (
        <Section key={size} title={`${size}px`}>
          <Row>
            {ENTRIES.slice(0, 10).map(([name, Icon]) => (
              <Icon key={name} style={{ width: size, height: size }} />
            ))}
          </Row>
        </Section>
      ))}
    </>
  ),
};

// currentColor를 쓰기 때문에 품는 요소의 글자색을 따라간다.
export const 색_상속: Story = {
  render: () => (
    <Row>
      {(
        [
          ["text", "var(--colors-text)"],
          ["text.muted", "var(--colors-text-muted)"],
          ["status.danger", "var(--colors-status-danger)"],
          ["text.mark", "var(--colors-text-mark)"],
        ] as const
      ).map(([label, color]) => (
        <Cell key={label} label={label}>
          <span style={{ color, display: "inline-flex", gap: 8 }}>
            {ENTRIES.slice(0, 6).map(([name, Icon]) => (
              <Icon key={name} style={{ width: 20, height: 20 }} />
            ))}
          </span>
        </Cell>
      ))}
    </Row>
  ),
};
