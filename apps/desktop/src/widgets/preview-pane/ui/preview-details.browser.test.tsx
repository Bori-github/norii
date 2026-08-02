import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";

import "@app/index.css";

import { resetTabTextRegistry, setTabText, useDocumentStore } from "@entities/document";
import { resetScrollSync } from "@features/scroll-sync";

import { PreviewPane } from "../index";

// 왜: summary 글자는 브라우저가 그리는 삼각형만큼 들어가 있는데, 펼친 내용은 왼쪽 끝에서
//     시작한다. 그러면 접기의 안과 밖이 같은 자리에서 시작해 구별되지 않는다.
// 보장: 펼친 내용이 summary 글자보다 왼쪽에서 시작하지 않고, 중첩되면 깊이마다 한 단계씩 더 들어간다.
// 경계: 들여쓰기의 정확한 값은 보지 않는다 — 삼각형 폭은 브라우저가 정한다.

const DETAILS = "<details open>\n<summary>펼쳐 보기</summary>\n\n안쪽 문단\n\n</details>";

const NESTED = [
  "<details open>",
  "<summary>바깥</summary>",
  "",
  "바깥 문단",
  "",
  "<details open>",
  "<summary>안쪽</summary>",
  "",
  "안쪽 문단",
  "",
  "</details>",
  "",
  "</details>",
].join("\n");

function paragraphOf(details: Element | undefined): Element | undefined {
  return [...(details?.children ?? [])].find((child) => child.tagName === "P");
}

function renderPreview(text: string) {
  const id = useDocumentStore.getState().addUntitledTab();
  setTabText(id, text);
  return render(
    <div style={{ width: 420, height: 400, display: "flex" }}>
      <PreviewPane />
    </div>,
  );
}

beforeEach(() => {
  useDocumentStore.setState({ tabs: [], activeTabId: null });
  resetTabTextRegistry();
  resetScrollSync();
});

afterEach(cleanup);

it("펼친 내용이 손잡이 글자에 맞춰 들어간다", async () => {
  const { container } = renderPreview(DETAILS);
  await waitFor(() => expect(container.querySelector("details")).not.toBeNull());

  const details = container.querySelector("details");
  const summary = container.querySelector("summary");
  const inner = [...(details?.children ?? [])].find((child) => child.tagName !== "SUMMARY");
  if (!summary || !inner) {
    throw new Error("손잡이나 펼친 내용을 찾지 못했습니다");
  }

  // summary 글자의 시작점 — 삼각형은 그 왼쪽에 있으므로 요소가 아니라 글자를 재야 한다.
  const range = document.createRange();
  range.selectNodeContents(summary);

  expect(inner.getBoundingClientRect().x).toBeGreaterThanOrEqual(range.getBoundingClientRect().x);
});

// 규칙이 첫 겹에만 걸리면 안쪽 접기가 바깥 문단과 같은 자리에서 시작해 구별되지 않는다.
it("중첩된 접기는 깊이마다 한 단계씩 더 들어간다", async () => {
  const { container } = renderPreview(NESTED);
  await waitFor(() => expect(container.querySelectorAll("details").length).toBe(2));

  const [outer, inner] = [...container.querySelectorAll("details")];
  const outerParagraph = paragraphOf(outer);
  const innerParagraph = paragraphOf(inner);
  if (!outerParagraph || !innerParagraph) {
    throw new Error("각 접기의 문단을 찾지 못했습니다");
  }

  expect(innerParagraph.getBoundingClientRect().x).toBeGreaterThan(
    outerParagraph.getBoundingClientRect().x,
  );
});
