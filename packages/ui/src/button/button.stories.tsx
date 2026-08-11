import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { Cell, Row, Section } from "../../.storybook/grid";

import { Button } from "./button";

const VARIANTS = ["accent", "outline", "ghost", "toggle"] as const;
const SIZES = ["2xs", "xs", "sm", "md"] as const;

const meta = {
  title: "Button/Button",
  component: Button,
  tags: ["autodocs"],
  args: { children: "폴더 열기", onClick: fn() },
  argTypes: {
    variant: { control: "inline-radio", options: VARIANTS },
    size: { control: "inline-radio", options: SIZES },
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

// render가 variant·size를 직접 순회하므로 그 컨트롤은 움직여도 반영되지 않는다.
export const 개요: Story = {
  parameters: { controls: { exclude: ["variant", "size"] } },
  render: (args) => (
    <>
      {VARIANTS.map((variant) => (
        <Section key={variant} title={variant}>
          <Row>
            {SIZES.map((size) => (
              <Cell key={size} label={size}>
                <Button {...args} variant={variant} size={size} />
              </Cell>
            ))}
          </Row>
        </Section>
      ))}
    </>
  ),
};

// toggle은 스위치 모양이 아니라 눌린 상태가 유지되는 버튼이다 — 사이드바 접기·프리뷰 전환이 쓴다.
export const 상태: Story = {
  parameters: { controls: { exclude: ["variant", "disabled"] } },
  render: (args) => (
    <Row>
      <Cell label="accent">
        <Button {...args} variant="accent" />
      </Cell>
      <Cell label="accent · disabled">
        <Button {...args} variant="accent" disabled />
      </Cell>
      <Cell label="toggle · aria-pressed=false">
        <Button {...args} variant="toggle" aria-pressed={false}>
          프리뷰
        </Button>
      </Cell>
      <Cell label="toggle · aria-pressed=true">
        <Button {...args} variant="toggle" aria-pressed>
          프리뷰
        </Button>
      </Cell>
    </Row>
  ),
};

export const 긴_글: Story = {
  args: { children: "이 문서를 저장하지 않고 닫으시겠습니까" },
};

export const Playground: Story = { args: { variant: "accent", size: "md" } };
