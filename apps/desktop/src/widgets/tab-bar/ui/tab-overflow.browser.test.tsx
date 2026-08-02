import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";

import "@app/index.css";

import { useDocumentStore } from "@entities/document";

import { TabBar } from "./tab-bar";

// 왜: 전역 스크롤바를 정의하면 macOS의 겹쳐 뜨는 스크롤바가 자리를 차지하는 것으로 바뀐다.
//     두께가 고정인 탭바에서는 그 높이만큼 보이는 영역이 줄어 탭 아래가 잘린다.
// 보장: 탭이 넘쳐 가로 스크롤이 생겨도 탭바의 보이는 높이가 줄지 않는다.
// 경계: 스크롤바의 모습(폭·색)은 여기서 보지 않는다 — 눈으로 판정한다.

beforeEach(() => {
  useDocumentStore.setState({
    tabs: Array.from({ length: 12 }, (_, index) => ({
      id: `t${index}`,
      title: `문서-${index}.md`,
      filePath: `/${index}.md`,
      isDirty: false,
    })) as never,
    activeTabId: "t0",
  });
});

afterEach(cleanup);

it("탭이 넘쳐도 탭바의 보이는 높이가 줄지 않는다", () => {
  const { getByTestId } = render(
    <div style={{ width: 400 }}>
      <TabBar />
    </div>,
  );
  const bar = getByTestId("tab-bar");
  expect(bar.scrollWidth).toBeGreaterThan(bar.clientWidth);
  // clientHeight는 테두리를 빼고 재므로, 스크롤바가 자리를 차지하지 않으면 차이가 테두리뿐이다.
  const border = Number.parseFloat(getComputedStyle(bar).borderBottomWidth);
  expect(bar.offsetHeight - bar.clientHeight).toBe(border);
});
