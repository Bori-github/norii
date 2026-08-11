import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { Cell, Row, Section } from "../../.storybook/grid";

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
  title: "Select",
  component: Select,
  tags: ["autodocs"],
  args: { "aria-label": "인코딩 다시 읽기", children: OPTIONS, onChange: fn() },
} satisfies Meta<typeof Select>;

export default meta;

type Story = StoryObj<typeof meta>;

export const 개요: Story = {
  render: (args) => (
    <>
      <Section title="폭">
        <Row>
          <Cell label="내용 폭">
            <Select {...args} />
          </Cell>
          <Cell label="상자 360px — 셀렉트가 따라 늘어난다">
            <div style={{ width: 360, display: "flex" }}>
              <Select {...args} />
            </div>
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

export const Playground: Story = {};
