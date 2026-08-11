import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

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

import { IconButton } from "./button";

const VARIANTS = ["ghost", "outline", "accent", "toggle"] as const;
const SIZES = ["2xs", "xs", "sm", "md"] as const;

const meta = {
  title: "Button/IconButton",
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
  parameters: { controls: { exclude: ["variant", "size"] } },
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

// 아이콘마다 획 수와 여백이 달라 같은 크기에서도 무게가 다르게 보인다.
export const 여러_아이콘: Story = {
  parameters: { controls: { exclude: ["children", "label"] } },
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

// toggle은 스위치 모양이 아니라 눌린 상태가 유지되는 버튼이다 — 사이드바 접기 버튼이 쓴다.
export const 상태: Story = {
  parameters: { controls: { exclude: ["variant", "disabled"] } },
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

export const Playground: Story = { args: { variant: "ghost", size: "md" } };
