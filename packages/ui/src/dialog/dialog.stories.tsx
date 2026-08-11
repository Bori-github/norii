import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Cell, Row, Section } from "../../.storybook/grid";
import { Button } from "../button/button";

import type { DialogProps } from "./dialog";
import { Dialog } from "./dialog";

const meta = {
  title: "Components/Dialog",
  component: Dialog,
  tags: ["autodocs"],
} satisfies Meta<typeof Dialog>;

export default meta;

type Story = StoryObj<typeof meta>;

function Trigger({ size, body }: { size: DialogProps["size"]; body: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="accent" onClick={() => setOpen(true)}>
        열기
      </Button>
      <Dialog open={open} size={size}>
        {body}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <Button onClick={() => setOpen(false)}>취소</Button>
          <Button variant="accent" onClick={() => setOpen(false)}>
            확인
          </Button>
        </div>
      </Dialog>
    </>
  );
}

export const 개요: Story = {
  args: { open: false, children: null },
  parameters: { controls: { disable: true } },
  render: () => (
    <Section title="크기">
      <Row>
        <Cell label="sm · 상자가 여백을 가짐">
          <Trigger size="sm" body={<p>저장하지 않은 변경이 있습니다. 닫을까요?</p>} />
        </Cell>
        <Cell label="lg · 내용이 경계까지 채움">
          <Trigger
            size="lg"
            body={
              <div style={{ padding: 24 }}>
                <h2 style={{ marginBottom: 12 }}>설정</h2>
                <p>머리말과 본문이 자기 경계까지 채우는 크기다.</p>
              </div>
            }
          />
        </Cell>
      </Row>
    </Section>
  ),
};

/**
 * 닫자마자 사라지면 회귀 — dialogOut이 끝날 때까지 남아야 함.
 * prefers-reduced-motion에서는 전환 없이 닫히므로 그 설정에서는 판정 불가.
 *
 * 전환이 눈에 보이는지는 사람이 보지만, 열리고 닫히는 것 자체는 여기서 확인한다 —
 * 전환을 기다리지 않고 언마운트하면 여는 것부터 깨진다.
 */
export const 전환: Story = {
  args: { open: false, children: null },
  parameters: { controls: { disable: true } },
  render: () => <Trigger size="sm" body={<p>열고 닫으며 전환을 본다.</p>} />,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    // dialogIn이 opacity 0에서 시작해 그 사이에 재면 안 보이는 것으로 나오기 때문에 기다린다.
    await step("열기를 누르면 대화상자가 뜬다", async () => {
      await userEvent.click(canvas.getByRole("button", { name: "열기" }));
      const dialog = await canvas.findByRole("dialog");
      await waitFor(() => expect(dialog).toBeVisible());
    });

    await step("취소를 누르면 전환이 끝난 뒤 사라진다", async () => {
      await userEvent.click(canvas.getByRole("button", { name: "취소" }));
      await waitFor(() => expect(canvas.queryByRole("dialog")).not.toBeInTheDocument());
    });
  },
};
