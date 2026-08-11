import type { Meta, StoryObj } from "@storybook/react-vite";

import { Section } from "../../.storybook/grid";
import { Button, IconButton } from "../button/button";
import { CloseIcon } from "../icons";

import { BANNER_STYLES, Banner, BannerBody } from "./banner";

const TONES = Object.keys(BANNER_STYLES.variants.tone);

const meta = {
  title: "Components/Banner",
  component: Banner,
  subcomponents: { BannerBody },
  tags: ["autodocs"],
  argTypes: { tone: { control: "inline-radio", options: TONES } },
} satisfies Meta<typeof Banner>;

export default meta;

type Story = StoryObj<typeof meta>;

export const 개요: Story = {
  args: { children: null },
  parameters: { controls: { disable: true } },
  render: () => (
    <>
      <Section title="tone=default · 액션 없음">
        <Banner>
          <BannerBody>파일을 UTF-8로 다시 읽었습니다.</BannerBody>
        </Banner>
      </Section>

      <Section title="tone=default · 액션 하나">
        <Banner>
          <BannerBody>저장할 때 인코딩이 UTF-8로 바뀝니다.</BannerBody>
          <Button variant="accent" size="sm">
            승인
          </Button>
        </Banner>
      </Section>

      <Section title="tone=default · 닫기 버튼">
        <Banner>
          <BannerBody>파일을 저장하지 못했습니다.</BannerBody>
          <IconButton size="sm" label="알림 닫기">
            <CloseIcon />
          </IconButton>
        </Banner>
      </Section>

      <Section title="tone=danger · 액션 둘">
        <Banner tone="danger">
          <BannerBody>파일이 밖에서 바뀌었습니다 — 어느 쪽을 남길지 고르세요.</BannerBody>
          <Button size="sm">편집 중인 것</Button>
          <Button size="sm">디스크의 것</Button>
        </Banner>
      </Section>

      <Section title="여러 줄 (whiteSpace: pre-line)">
        <Banner>
          <BannerBody>{"저장할 때 인코딩이 UTF-8로 바뀝니다.\n개행도 LF로 통일됩니다."}</BannerBody>
          <Button variant="accent" size="sm">
            승인
          </Button>
        </Banner>
      </Section>
    </>
  ),
};

/** 좁아지면 액션이 아랫줄로 내려가는 것 — 버튼이 상자 밖으로 잘리면 회귀 */
export const 좁은_폭: Story = {
  args: { children: null },
  parameters: { controls: { disable: true } },
  render: () => (
    <>
      {[400, 280, 240].map((width) => (
        <Section key={width} title={`${width}px`}>
          <div style={{ width }}>
            <Banner tone="danger">
              <BannerBody>파일이 밖에서 바뀌었습니다 — 어느 쪽을 남길지 고르세요.</BannerBody>
              <Button size="sm">편집 중인 것</Button>
              <Button size="sm">디스크의 것</Button>
            </Banner>
          </div>
        </Section>
      ))}
    </>
  ),
};

export const Playground: Story = {
  args: {
    tone: "default",
    children: (
      <>
        <BannerBody>파일이 디스크에서 사라졌습니다.</BannerBody>
        <Button variant="accent" size="sm">
          다시 만들기
        </Button>
      </>
    ),
  },
};
