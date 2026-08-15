import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { Cell, Row, Section } from "../../.storybook/grid";
import {
  ChevronRightIcon,
  CloseIcon,
  ColumnVerticalIcon,
  CopyRightIcon,
  EditIcon,
  FilePlusIcon,
  FolderPlusIcon,
  PanelLeftIcon,
  PlusIcon,
  SettingsIcon,
} from "../icons";

import { BUTTON_STYLES, IconButton } from "./button";

const VARIANTS = Object.keys(
  BUTTON_STYLES.variants.variant,
) as (keyof typeof BUTTON_STYLES.variants.variant)[];
const SIZES = Object.keys(
  BUTTON_STYLES.variants.size,
) as (keyof typeof BUTTON_STYLES.variants.size)[];

const meta = {
  title: "Components/IconButton",
  component: IconButton,
  tags: ["autodocs"],
  args: { label: "닫기", children: <CloseIcon />, onClick: fn() },
  argTypes: {
    variant: { control: "inline-radio", options: VARIANTS },
    size: { control: "inline-radio", options: SIZES },
  },
} satisfies Meta<typeof IconButton>;

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
                <IconButton {...args} variant={variant} size={size} />
              </Cell>
            ))}
          </Row>
        </Section>
      ))}
    </>
  ),
};

export const 여러_아이콘: Story = {
  argTypes: { children: { control: false }, label: { control: false } },
  render: (args) => (
    <Row>
      {(
        [
          ["닫기", <CloseIcon key="c" />],
          ["새 파일", <FilePlusIcon key="f" />],
          ["새 폴더", <FolderPlusIcon key="d" />],
          ["이름 변경", <EditIcon key="e" />],
          ["설정", <SettingsIcon key="s" />],
          ["사이드바", <PanelLeftIcon key="p" />],
          ["분할", <ColumnVerticalIcon key="v" />],
          ["복사", <CopyRightIcon key="y" />],
          ["펼치기", <ChevronRightIcon key="r" />],
          ["더하기", <PlusIcon key="l" />],
        ] as const
      ).map(([label, icon]) => (
        <Cell key={label} label={label}>
          <IconButton {...args} label={label}>
            {icon}
          </IconButton>
        </Cell>
      ))}
    </Row>
  ),
};

export const 상태: Story = {
  argTypes: { variant: { control: false }, disabled: { control: false } },
  render: (args) => (
    <Row>
      <Cell label="ghost">
        <IconButton {...args} />
      </Cell>
      <Cell label="ghost · disabled">
        <IconButton {...args} disabled />
      </Cell>
      <Cell label="toggle · aria-pressed=false">
        <IconButton {...args} variant="toggle" label="사이드바" aria-pressed={false}>
          <PanelLeftIcon />
        </IconButton>
      </Cell>
      <Cell label="toggle · aria-pressed=true">
        <IconButton {...args} variant="toggle" label="사이드바" aria-pressed>
          <PanelLeftIcon />
        </IconButton>
      </Cell>
    </Row>
  ),
};

/**
 * 화면에 글자가 없어 label이 유일한 접근성 이름이기 때문에, 그 이름으로 버튼을 찾을 수
 * 있는지 확인해 둔다 — 이름이 사라지면 스크린리더에서 "버튼"으로만 읽힌다.
 */
export const Playground: Story = {
  args: { variant: "ghost", size: "md" },
  play: async ({ args, canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: "닫기" });

    await userEvent.click(button);

    await expect(args.onClick).toHaveBeenCalled();
  },
};
