import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { useState } from "react";

import { Cell, Row, Section } from "../../.storybook/grid";
import { Button } from "../button/button";

import { Dialog } from "./dialog";

const meta = {
  title: "Dialog",
  component: Dialog,
  tags: ["autodocs"],
} satisfies Meta<typeof Dialog>;

export default meta;

type Story = StoryObj<typeof meta>;

// showModal()로 뜨기 때문에 두 크기를 동시에 띄울 수 없다 — 버튼으로 하나씩 연다.
function Trigger({ size, body }: { size: "sm" | "lg"; body: ReactNode }) {
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
    <Section title="크기 — 여백을 상자가 갖는가, 내용이 갖는가">
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

// 열고 닫으며 dialogIn·dialogOut 전환을 본다. prefers-reduced-motion에서는 전환 없이 닫힌다.
export const 전환: Story = {
  args: { open: false, children: null },
  parameters: { controls: { disable: true } },
  render: () => <Trigger size="sm" body={<p>열고 닫으며 전환을 본다.</p>} />,
};
