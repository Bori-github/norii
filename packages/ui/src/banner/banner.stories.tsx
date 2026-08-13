import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { Section } from "../../.storybook/grid";
import { Button, IconButton } from "../button/button";
import { CloseIcon } from "../icons";

import { BANNER_STYLES, Banner, BannerActions, BannerBody } from "./banner";

const TONES = Object.keys(BANNER_STYLES.variants.tone);

const meta = {
  title: "Components/Banner",
  component: Banner,
  subcomponents: { BannerBody, BannerActions },
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
          <BannerActions>
            <Button variant="accent" size="sm">
              승인
            </Button>
          </BannerActions>
        </Banner>
      </Section>

      <Section title="tone=default · 닫기 버튼">
        <Banner>
          <BannerBody>파일을 저장하지 못했습니다.</BannerBody>
          <BannerActions>
            <IconButton size="sm" label="알림 닫기">
              <CloseIcon />
            </IconButton>
          </BannerActions>
        </Banner>
      </Section>

      <Section title="tone=danger · 액션 둘">
        <Banner tone="danger">
          <BannerBody>파일이 밖에서 바뀌었습니다 — 어느 쪽을 남길지 고르세요.</BannerBody>
          <BannerActions>
            <Button size="sm">편집 중인 것</Button>
            <Button size="sm">디스크의 것</Button>
          </BannerActions>
        </Banner>
      </Section>

      <Section title="여러 줄 (whiteSpace: pre-line)">
        <Banner>
          <BannerBody>{"저장할 때 인코딩이 UTF-8로 바뀝니다.\n개행도 LF로 통일됩니다."}</BannerBody>
          <BannerActions>
            <Button variant="accent" size="sm">
              승인
            </Button>
          </BannerActions>
        </Banner>
      </Section>
    </>
  ),
};

/** 액션이 둘인 배너가 분할 칸만큼 좁아졌을 때 */
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
              <BannerActions>
                <Button size="sm">편집 중인 것</Button>
                <Button size="sm">디스크의 것</Button>
              </BannerActions>
            </Banner>
          </div>
        </Section>
      ))}
    </>
  ),
  play: async ({ canvasElement, step }) => {
    const banners = within(canvasElement).getAllByRole("alert");

    await step("어느 폭에서도 액션이 상자 안에 남는다", async () => {
      const jutOut = banners.flatMap((banner) => {
        const box = banner.getBoundingClientRect();
        return within(banner)
          .getAllByRole("button")
          .map((action) => Math.round(action.getBoundingClientRect().right - box.right))
          .filter((px) => px > 0);
      });
      await expect(jutOut).toEqual([]);
    });

    await step("액션은 아랫줄로 내려가도 오른쪽에 붙는다", async () => {
      const gaps = banners.map((banner) => {
        const actions = banner.lastElementChild as Element;
        const fromRight =
          banner.getBoundingClientRect().right - actions.getBoundingClientRect().right;
        return Math.round(fromRight - parseFloat(getComputedStyle(banner).paddingRight));
      });
      await expect(gaps.filter((px) => px !== 0)).toEqual([]);
    });

    await step("본문은 한 글자 폭까지 줄지 않는다", async () => {
      // min-width가 빠지면 0px으로 풀린다.
      const floors = banners.map((banner) =>
        parseFloat(getComputedStyle(within(banner).getByText(/파일이/)).minWidth),
      );
      await expect(floors.filter((px) => px <= 0)).toEqual([]);
    });
  },
};

export const Playground: Story = {
  args: {
    tone: "default",
    children: (
      <>
        <BannerBody>파일이 디스크에서 사라졌습니다.</BannerBody>
        <BannerActions>
          <Button variant="accent" size="sm">
            다시 만들기
          </Button>
        </BannerActions>
      </>
    ),
  },
};
