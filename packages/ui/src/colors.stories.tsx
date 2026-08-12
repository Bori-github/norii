import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { ColorBand } from "../.storybook/color-band";
import { PRIMITIVE, SEMANTIC, readGroup, readSteps } from "../.storybook/tokens";

// 카탈로그 페이지가 `.mdx`라 게이트 밖이므로 렌더만 여기서 돌린다. 사이드바에는 내보내지 않는다.
const meta = {
  title: "Foundations/Colors",
  tags: ["!dev", "!autodocs"],
  parameters: { controls: { disable: true } },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * @description
 * 토큰 이름이 preset과 어긋나면 계산값이 빈 문자열이 되고 띠에 빈 칸이 남는다.
 */
export const 값이_빈_토큰이_없다: Story = {
  render: () => (
    <>
      {Object.keys(SEMANTIC).map((name) => (
        <ColorBand key={name} group={readGroup(name)} />
      ))}
    </>
  ),
  play: async () => {
    const semantic = Object.keys(SEMANTIC).flatMap((name) => {
      const group = readGroup(name);
      return group.tokens.filter((token) => !group.light[token] || !group.dark[token]);
    });
    const primitive = Object.keys(PRIMITIVE).flatMap((name) =>
      Object.entries(readSteps(name))
        .filter(([, value]) => !value)
        .map(([step]) => step),
    );

    await expect([...semantic, ...primitive]).toEqual([]);
  },
};
