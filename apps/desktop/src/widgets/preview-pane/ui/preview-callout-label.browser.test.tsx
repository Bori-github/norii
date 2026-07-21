import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import "@app/index.css";

import { resetTabTextRegistry, setTabText, useDocumentStore } from "@entities/document";
import { resetScrollSync } from "@features/scroll-sync";

import { CALLOUT_ICON_CLASS } from "../model/use-callouts";
import { PreviewPane } from "../index";

// 집행: preview-strategy.md#콜아웃-gfm-alerts — 아이콘은 마크업이 아니라 소비 측이 붙인다.
//
// 왜: 아이콘을 markdown-it가 마크업으로 내면 sanitize가 `svg`를 통과시켜야 하고, 그러면
//     **문서가 적은 `<svg>`도 함께 통과한다**. 우리가 렌더 뒤에 꽂으면 sanitize 설정은
//     그대로다 — 이 테스트가 그 경계를 지킨다.
// 보장: 다섯 종류가 각자 다른 아이콘을 갖고, 렌더 스왑 뒤에도 다시 붙으며,
//       5종 밖의 인용문에는 붙지 않는다. 아이콘은 스크롤 매핑을 오염시키지 않는다.
// 경계: 어느 그림이 어느 종류에 어울리는지는 계산으로 판정할 수 없어 눈으로 본다
//       (→ examples/프리뷰-기본.md).

const FIVE_CALLOUTS = [
  "> [!NOTE]\n> 참고",
  "> [!TIP]\n> 팁",
  "> [!IMPORTANT]\n> 중요",
  "> [!WARNING]\n> 주의",
  "> [!CAUTION]\n> 위험",
].join("\n\n");

beforeEach(() => {
  useDocumentStore.setState({ tabs: [], activeTabId: null });
  resetTabTextRegistry();
  resetScrollSync();
});

afterEach(cleanup);

function openTabWith(text: string): string {
  const tabId = "tab-1";
  useDocumentStore.setState({
    tabs: [{ id: tabId, path: "/문서.md", name: "문서.md", isDirty: false }],
    activeTabId: tabId,
  } as never);
  setTabText(tabId, text);
  return tabId;
}

async function findIcons(container: HTMLElement, count: number): Promise<Element[]> {
  return await waitFor(() => {
    const icons = [...container.querySelectorAll(`.${CALLOUT_ICON_CLASS}`)];
    expect(icons).toHaveLength(count);
    return icons;
  });
}

describe("콜아웃 라벨", () => {
  // 이름은 CSS content가 아니라 React가 렌더한다 — 파서가 낸 마크업에는 없는 글자라,
  // 라벨이 붙지 않으면 상자에 종류가 아예 표시되지 않는다.
  it("다섯 종류가 GitHub과 같은 이름을 단다", async () => {
    openTabWith(FIVE_CALLOUTS);
    const { container } = render(<PreviewPane />);
    await findIcons(container, 5);
    for (const label of ["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"]) {
      expect(container.textContent).toContain(label);
    }
  });

  it("다섯 종류가 각각 아이콘을 갖는다", async () => {
    openTabWith(FIVE_CALLOUTS);
    const { container } = render(<PreviewPane />);
    await findIcons(container, 5);
  });

  // 같은 그림이 둘에 쓰이면 색만으로 갈리게 되고, 색을 구별하지 못하는 사용자에게는
  // 라벨 글자 하나만 남는다(→ preview-strategy.md#콜아웃-gfm-alerts).
  it("다섯 아이콘이 서로 다른 그림이다", async () => {
    openTabWith(FIVE_CALLOUTS);
    const { container } = render(<PreviewPane />);
    const icons = await findIcons(container, 5);
    const shapes = icons.map((icon) => icon.innerHTML);
    expect(new Set(shapes).size).toBe(5);
  });

  it("5종 밖의 인용문에는 붙지 않는다", async () => {
    openTabWith("> 평범한 인용문\n\n> [!FOO]\n> 알 수 없는 종류");
    const { container } = render(<PreviewPane />);
    await waitFor(() => expect(container.querySelector("blockquote")).not.toBeNull());
    expect(container.querySelectorAll(`.${CALLOUT_ICON_CLASS}`)).toHaveLength(0);
  });

  it("프리뷰가 다시 렌더되면 아이콘도 다시 붙는다 — innerHTML 교체가 지우기 때문이다", async () => {
    const tabId = openTabWith("> [!NOTE]\n> 처음");
    const { container } = render(<PreviewPane />);
    await findIcons(container, 1);
    setTabText(tabId, "> [!NOTE]\n> 바뀜\n\n> [!WARNING]\n> 하나 더");
    await findIcons(container, 2);
  });

  it("아이콘은 스크롤 매핑을 오염시키지 않는다 — 라인 꼬리표가 없다", async () => {
    openTabWith(FIVE_CALLOUTS);
    const { container } = render(<PreviewPane />);
    const icons = await findIcons(container, 5);
    for (const icon of icons) {
      expect(icon.hasAttribute("data-source-line")).toBe(false);
    }
  });
});
