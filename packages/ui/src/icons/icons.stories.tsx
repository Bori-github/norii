import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ComponentType, SVGProps } from "react";
import { expect } from "storybook/test";

import * as icons from "./index";

const ENTRIES = Object.entries(
  icons as Record<string, ComponentType<SVGProps<SVGSVGElement>>>,
).filter(([name]) => name.endsWith("Icon"));

// 카탈로그 페이지가 `.mdx`라 게이트 밖이므로 렌더만 여기서 돌린다. 사이드바에는 내보내지 않는다.
const meta = {
  title: "Foundations/Icons",
  tags: ["!dev", "!autodocs"],
  parameters: { controls: { disable: true } },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * @description
 * 아이콘은 SVG에서 생성한다. 컴포넌트 스토리는 그중 일부만 쓰므로 나머지가 깨져도 지나친다.
 */
export const 배럴의_아이콘이_모두_그려진다: Story = {
  render: () => (
    <div data-testid="icons">
      {ENTRIES.map(([name, Icon]) => (
        <Icon key={name} style={{ width: 20, height: 20 }} />
      ))}
    </div>
  ),
  play: async ({ canvas }) => {
    const drawn = canvas.getByTestId("icons").querySelectorAll("svg");

    await expect(drawn).toHaveLength(ENTRIES.length);
  },
};
