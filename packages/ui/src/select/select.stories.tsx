import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { css } from "styled-system/css";

import { Cell, Row, Section } from "../../.storybook/grid";
import { resolvedColor } from "../../.storybook/tokens";

import { Select } from "./select";

const OPTIONS = (
  <>
    <option value="">인코딩 다시 읽기</option>
    <option value="utf-8">UTF-8</option>
    <option value="euc-kr">EUC-KR</option>
    <option value="utf-16le">UTF-16LE</option>
  </>
);

const meta = {
  title: "Components/Select",
  component: Select,
  tags: ["autodocs"],
  args: { "aria-label": "인코딩 다시 읽기", children: OPTIONS, onChange: fn() },
} satisfies Meta<typeof Select>;

export default meta;

type Story = StoryObj<typeof meta>;

export const 개요: Story = {
  play: async ({ canvasElement }) => {
    const [내용_폭, 지정_폭] = within(canvasElement).getAllByRole("combobox");

    await expect(Math.round(지정_폭?.getBoundingClientRect().width ?? 0)).toBe(360);
    await expect(내용_폭?.getBoundingClientRect().width).toBeLessThan(360);
  },
  render: (args) => (
    <>
      <Section title="폭">
        <Row>
          <Cell label="내용 폭">
            <Select {...args} />
          </Cell>
          <Cell label="wrapClassName으로 360px">
            <Select {...args} wrapClassName={css({ width: "360px" })} />
          </Cell>
        </Row>
      </Section>

      <Section title="상태">
        <Row>
          <Cell label="기본">
            <Select {...args} />
          </Cell>
          <Cell label="선택됨">
            <Select {...args} defaultValue="euc-kr" />
          </Cell>
          <Cell label="disabled">
            <Select {...args} disabled />
          </Cell>
        </Row>
      </Section>

      <Section title="긴 항목">
        <Select aria-label="긴 항목">
          <option>아주 긴 인코딩 이름이 들어간 항목입니다 — 꺽쇠와 겹치지 않아야 한다</option>
        </Select>
      </Section>
    </>
  ),
};

/**
 * 감싸는 요소를 하나 더 두는 구조라 이벤트가 새지 않는지 확인해 둔다 — 고르면 값이 바뀌고
 * onChange가 불린다.
 */
export const Playground: Story = {
  play: async ({ args, canvasElement }) => {
    const select = within(canvasElement).getByRole("combobox");

    await userEvent.selectOptions(select, "euc-kr");

    await expect(select).toHaveValue("euc-kr");
    await expect(args.onChange).toHaveBeenCalled();
  },
};

export const 다크: Story = {
  tags: ["!dev", "!autodocs"],
  parameters: { controls: { disable: true } },
  globals: { theme: "dark" },
  play: async ({ canvasElement }) => {
    const select = within(canvasElement).getByRole("combobox");
    const style = getComputedStyle(select);

    await expect(style.backgroundColor).toBe(resolvedColor(select, "bg.hover"));
    await expect(style.color).toBe(resolvedColor(select, "text"));
    await expect(style.borderColor).toBe(resolvedColor(select, "border"));
  },
};
