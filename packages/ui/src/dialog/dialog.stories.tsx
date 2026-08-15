import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Cell, Row, Section } from "../../.storybook/grid";
import { resolvedColor } from "../../.storybook/tokens";
import { Button } from "../button/button";

import type { DialogProps } from "./dialog";
import { Dialog, DialogBody, DialogFooter, DialogHeader } from "./dialog";

const meta = {
  title: "Components/Dialog",
  component: Dialog,
  subcomponents: { DialogHeader, DialogBody, DialogFooter },
  tags: ["autodocs"],
} satisfies Meta<typeof Dialog>;

export default meta;

type Story = StoryObj<typeof meta>;

function Trigger({
  width,
  header,
  divider,
}: {
  width?: DialogProps["width"];
  header?: string;
  divider?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="accent" onClick={() => setOpen(true)}>
        열기
      </Button>
      <Dialog open={open} width={width}>
        {header ? (
          <DialogHeader divider={divider}>
            <strong>{header}</strong>
          </DialogHeader>
        ) : null}
        <DialogBody>저장하지 않은 변경이 있습니다. 닫을까요?</DialogBody>
        <DialogFooter divider={divider}>
          <Button onClick={() => setOpen(false)}>취소</Button>
          <Button variant="accent" onClick={() => setOpen(false)}>
            확인
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}

export const 개요: Story = {
  args: { open: false, children: null },
  parameters: { controls: { disable: true } },
  render: () => (
    <>
      <Section title="폭">
        <Row>
          <Cell label="sm">
            <Trigger />
          </Cell>
          <Cell label="lg">
            <Trigger width="lg" header="설정" />
          </Cell>
        </Row>
      </Section>

      <Section title="구분선">
        <Row>
          <Cell label="없음">
            <Trigger header="설정" />
          </Cell>
          <Cell label="있음">
            <Trigger header="설정" divider />
          </Cell>
        </Row>
      </Section>
    </>
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
  render: () => <Trigger />,
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

/**
 * @description
 * 스타일 객체가 아니라 계산된 값을 확인한다 — `padding: "4 5"`처럼 Panda가 읽지 못하는 표기는
 * 객체만 보면 통과하고 화면에서 0이 된다.
 */
const renderParts = () => (
  <Dialog open>
    <DialogHeader data-testid="header">제목</DialogHeader>
    <DialogBody data-testid="body">본문</DialogBody>
    <DialogFooter data-testid="footer">
      <Button>확인</Button>
    </DialogFooter>
  </Dialog>
);

export const 계산된_값: Story = {
  tags: ["!dev", "!autodocs"],
  args: { open: true, children: null },
  parameters: { controls: { disable: true } },
  render: renderParts,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const styleOf = (id: string) => getComputedStyle(canvas.getByTestId(id));

    await step("세 영역 모두 여백이 있다", async () => {
      const paddings = ["header", "body", "footer"].map((part) => styleOf(part).padding);
      await expect(paddings).not.toContain("0px");
    });

    await step("divider 없이는 선이 없다", async () => {
      await expect(styleOf("header").borderBottomWidth).toBe("0px");
      await expect(styleOf("footer").borderTopWidth).toBe("0px");
    });

    await step("상자는 불투명하고 뒤에는 딤이 있다", async () => {
      const dialog = canvasElement.querySelector("dialog");
      if (!dialog) {
        throw new Error("대화상자를 찾지 못했다");
      }
      // 알파가 있으면 창 유리의 흐림이 상자를 통과해 비친다.
      await expect(getComputedStyle(dialog).backgroundColor).toMatch(/^rgb\(/);
      await expect(getComputedStyle(dialog, "::backdrop").backgroundColor).not.toBe(
        "rgba(0, 0, 0, 0)",
      );
    });
  },
};

export const 계산된_값_다크: Story = {
  tags: ["!dev", "!autodocs"],
  globals: { theme: "dark" },
  args: { open: true, children: null },
  parameters: { controls: { disable: true } },
  render: renderParts,
  play: async ({ canvasElement, step }) => {
    const dialog = canvasElement.querySelector("dialog");
    if (!dialog) {
      throw new Error("대화상자를 찾지 못했다");
    }
    const background = getComputedStyle(dialog).backgroundColor;

    await step("상자는 이 테마의 bg.paper를 쓴다", async () => {
      await expect(document.documentElement.dataset["theme"]).toBe("dark");
      await expect(background).toBe(resolvedColor(dialog, "bg.paper"));
    });

    await step("상자는 다크에서도 불투명하다", async () => {
      await expect(background).toMatch(/^rgb\(/);
    });
  },
};
