import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";

import { Cell, Row, Section } from "../../.storybook/grid";

import { Tooltip } from "./tooltip";

const meta = {
  title: "Tooltip",
  component: Tooltip,
  tags: ["autodocs"],
  args: { children: "같은 이름의 파일이 이미 있습니다" },
} satisfies Meta<typeof Tooltip>;

export default meta;

type Story = StoryObj<typeof meta>;

function Anchor({ children, width = 160 }: { children: ReactNode; width?: number }) {
  return (
    <div style={{ position: "relative", display: "inline-block", width, paddingBottom: 44 }}>
      {children}
    </div>
  );
}

export const 개요: Story = {
  argTypes: { pointerX: { control: false }, id: { control: false } },
  render: (args) => (
    <>
      <Section title="꼭짓점 위치 (pointerX)">
        <Row>
          {["12px", "50%", "calc(100% - 12px)"].map((x) => (
            <Cell key={x} label={x}>
              <Anchor>
                <input
                  aria-describedby={`tip-${x}`}
                  defaultValue="README.md"
                  style={{ width: "100%" }}
                />
                <Tooltip {...args} id={`tip-${x}`} pointerX={x}>
                  pointerX = {x}
                </Tooltip>
              </Anchor>
            </Cell>
          ))}
        </Row>
      </Section>

      <Section title="글 길이">
        <Row>
          <Cell label="짧게">
            <Anchor>
              <input aria-describedby="tip-short" defaultValue="a.md" style={{ width: "100%" }} />
              <Tooltip id="tip-short">이름이 비었습니다</Tooltip>
            </Anchor>
          </Cell>
          <Cell label="길게 — 줄바꿈하지 않는다">
            <Anchor width={260}>
              <input
                aria-describedby="tip-long"
                defaultValue="README.md"
                style={{ width: "100%" }}
              />
              <Tooltip id="tip-long">이름에 / 는 쓸 수 없습니다 — 다른 이름을 넣어 주세요</Tooltip>
            </Anchor>
          </Cell>
        </Row>
      </Section>
    </>
  ),
};

export const Playground: Story = {
  render: (args) => (
    <Anchor>
      <input aria-describedby="tip" defaultValue="README.md" style={{ width: "100%" }} />
      <Tooltip {...args} id="tip" />
    </Anchor>
  ),
};
