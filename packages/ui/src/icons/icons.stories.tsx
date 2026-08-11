import { IconGallery, IconItem } from "@storybook/addon-docs/blocks";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ComponentType, SVGProps } from "react";

import { Cell, Row, Section } from "../../.storybook/grid";

import * as icons from "./index";

// 배럴에서 직접 읽기 때문에 아이콘을 더해도 이 파일은 손대지 않음
const ENTRIES = Object.entries(icons as Record<string, ComponentType<SVGProps<SVGSVGElement>>>)
  .filter(([name]) => name.endsWith("Icon"))
  .toSorted(([a], [b]) => a.localeCompare(b));

const meta = {
  title: "Icons",
  tags: ["autodocs"],
  parameters: {
    controls: { disable: true },
    docs: { description: { component: "`@norii/ui/icons`가 내보내는 아이콘 전체" } },
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const 전체: Story = {
  render: () => (
    <>
      <p style={{ fontSize: 13, marginBottom: 20 }}>
        <code>{'import { CloseIcon } from "@norii/ui/icons";'}</code>
      </p>
      <IconGallery>
        {ENTRIES.map(([name, Icon]) => (
          <IconItem key={name} name={name}>
            <Icon style={{ width: 24, height: 24 }} />
          </IconItem>
        ))}
      </IconGallery>
    </>
  ),
};

/** 아이콘 자체에는 크기가 없기 때문에(viewBox만 있음) width·height를 CSS로 지정 */
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

/** stroke가 currentColor이기 때문에 부모 요소의 글자색을 따라감 */
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
