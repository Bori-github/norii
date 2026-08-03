import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";

import "@app/index.css";

import { resetTabTextRegistry, setTabText, useDocumentStore } from "@entities/document";
import { resetScrollSync } from "@features/scroll-sync";

import { PreviewPane } from "../index";

// 왜: 한글은 글자 사이 어디서나 줄바꿈되므로 브라우저가 잡는 열의 최소 너비가 한 글자다. 열이
//     많은 표에서 자리가 모자라면 한글 열만 그 너비까지 좁아진다.
// 보장: 좁은 패널에서도 한글 열의 너비가 한 글자를 넘는다.
// 경계: 표가 패널보다 넓어지는 것은 막지 않는다 — 그 경우의 가로 스크롤은 preview-pane 테스트가
//       검증한다. 셀 안이 인라인 코드뿐이면 글자가 셀보다 작아 기준이 넓게 잡히므로 대상이 아니다.

const KOREAN_TABLE = [
  "| 마일스톤 | 내용 | 산출물 | 문서 | 검증 | 비고 |",
  "|---|---|---|---|---|---|",
  "| M3 | 프리뷰 분할 렌더 스크롤 동기화 | 소스 옆 프리뷰 | preview-strategy.md | 브라우저 | 완료 |",
].join("\n");

function px(value: string): number {
  return Number.parseFloat(value);
}

/**
 * 그 셀에 한 글자만 들어갔을 때의 너비. 글자 크기·여백·테두리를 셀에서 직접 읽는다 — 열마다
 * 값이 다르거나 토큰이 바뀌어도 기준이 따라간다. 한글은 정사각에 가까워 글자 폭이 글자 크기와
 * 거의 같다.
 */
function oneLetterWidth(cell: Element): number {
  const style = getComputedStyle(cell);
  return (
    px(style.fontSize) +
    px(style.paddingLeft) +
    px(style.paddingRight) +
    px(style.borderLeftWidth) +
    px(style.borderRightWidth)
  );
}

beforeEach(() => {
  useDocumentStore.setState({ tabs: [], activeTabId: null });
  resetTabTextRegistry();
  resetScrollSync();
});

afterEach(cleanup);

it("좁은 패널에서도 한글 열이 한 글자 폭으로 접히지 않는다", async () => {
  const id = useDocumentStore.getState().addUntitledTab();
  setTabText(id, KOREAN_TABLE);
  const { container } = render(
    <div style={{ width: 420, height: 400, display: "flex" }}>
      <PreviewPane />
    </div>,
  );
  await waitFor(() => expect(container.querySelector("td")).not.toBeNull());

  const collapsed = [...container.querySelectorAll("td")]
    .filter((cell) => cell.getBoundingClientRect().width <= oneLetterWidth(cell))
    .map((cell) => cell.textContent);
  expect(collapsed).toEqual([]);
});
