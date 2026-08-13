import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { expect, within } from "storybook/test";
import { css } from "styled-system/css";

import { Cell, Row, Section } from "../../.storybook/grid";

import { Tooltip } from "./tooltip";

const meta = {
  title: "Components/Tooltip",
  component: Tooltip,
  tags: ["autodocs"],
  args: { children: "같은 이름의 파일이 이미 있습니다" },
} satisfies Meta<typeof Tooltip>;

export default meta;

type Story = StoryObj<typeof meta>;

const tipClass = css({ left: "3" });

function Anchor({ children, width = 160 }: { children: ReactNode; width?: number }) {
  return (
    <div style={{ display: "inline-block", width, paddingBottom: 52 }}>
      <div style={{ position: "relative" }}>{children}</div>
    </div>
  );
}

export const 개요: Story = {
  argTypes: { pointerX: { control: false }, id: { control: false } },
  play: async ({ canvasElement }) => {
    const heightOf = (id: string) =>
      canvasElement.querySelector(`#${id}`)?.getBoundingClientRect().height;

    const oneLine = heightOf("tip-short");

    // 긴 글은 상자를 넘겨서라도 한 줄로 뻗고, \n을 넣은 것만 두 줄이 된다.
    await expect(heightOf("tip-long")).toBe(oneLine);
    await expect(heightOf("tip-multiline")).toBeGreaterThan(oneLine ?? 0);
  },
  render: (args) => (
    <>
      <Section title="꼭짓점 위치 (pointerX)">
        <Row>
          {["12px", "50%", "calc(100% - 12px)"].map((x) => (
            <Cell key={x} label={x}>
              <Anchor>
                <input
                  aria-label="파일 이름"
                  aria-describedby={`tip-${x}`}
                  defaultValue="README.md"
                  style={{ width: "100%" }}
                />
                <Tooltip {...args} className={tipClass} id={`tip-${x}`} pointerX={x}>
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
              <input
                aria-label="파일 이름"
                aria-describedby="tip-short"
                defaultValue="a.md"
                style={{ width: "100%" }}
              />
              <Tooltip className={tipClass} id="tip-short">
                이름이 비었습니다
              </Tooltip>
            </Anchor>
          </Cell>
          <Cell label="길게">
            <Anchor width={260}>
              <input
                aria-label="파일 이름"
                aria-describedby="tip-long"
                defaultValue="README.md"
                style={{ width: "100%" }}
              />
              <Tooltip className={tipClass} id="tip-long">
                이름에 / 는 쓸 수 없습니다 — 다른 이름을 넣어 주세요
              </Tooltip>
            </Anchor>
          </Cell>
          <Cell label="줄바꿈(\n)">
            <Anchor width={260}>
              <input
                aria-label="파일 이름"
                aria-describedby="tip-multiline"
                defaultValue="README.md"
                style={{ width: "100%" }}
              />
              <Tooltip className={tipClass} id="tip-multiline">
                {"이름에 / 는 쓸 수 없습니다\n다른 이름을 넣어 주세요"}
              </Tooltip>
            </Anchor>
          </Cell>
        </Row>
      </Section>
    </>
  ),
};

/**
 * id를 넘기지 않으면 문구가 보이기만 하고 스크린리더에는 닿지 않기 때문에, 연결이 실제로
 * 되는지 확인해 둔다 — 눈으로는 두 경우가 똑같아 보인다.
 */
export const Playground: Story = {
  render: (args) => (
    <Anchor>
      <input
        aria-label="파일 이름"
        aria-describedby="tip"
        defaultValue="README.md"
        style={{ width: "100%" }}
      />
      <Tooltip {...args} className={tipClass} id="tip" />
    </Anchor>
  ),
  play: async ({ args, canvasElement }) => {
    const input = within(canvasElement).getByRole("textbox", { name: "파일 이름" });

    await expect(input).toHaveAccessibleDescription(String(args.children));
  },
};
