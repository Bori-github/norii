import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { Cell, Row, Section } from "../../.storybook/grid";

import { BUTTON_STYLES, Button } from "./button";

const VARIANTS = Object.keys(
  BUTTON_STYLES.variants.variant,
) as (keyof typeof BUTTON_STYLES.variants.variant)[];
const SIZES = Object.keys(
  BUTTON_STYLES.variants.size,
) as (keyof typeof BUTTON_STYLES.variants.size)[];

const meta = {
  title: "Components/Button",
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

export const 개요: Story = {
  argTypes: { variant: { control: false }, size: { control: false } },
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

export const 상태: Story = {
  argTypes: { variant: { control: false }, disabled: { control: false } },
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
