import { cleanup, render, waitFor } from "@testing-library/react";
import { userEvent } from "vitest/browser";
import { afterEach, beforeEach, expect, it } from "vitest";

import "@app/index.css";

import { useDocumentStore } from "@entities/document";
import { useConflictStore, useMissingFileStore } from "@features/save-file";

import { TabBar } from "./tab-bar";

// 왜: 활성 탭의 배경(bg.paper)과 호버의 상태 배경(bg.hover)은 specificity가 같다. 나중에 정의된
//     호버가 적용되면 활성 탭을 호버할 때마다 배경이 덮여, 어느 탭이 활성인지 흐려진다.
// 보장: 호버해도 활성 탭의 배경은 그대로고, 비활성 탭의 배경은 바뀐다.
// 경계: 바뀐 배경의 색은 보지 않는다 — 바뀌는지 아닌지만 본다.

const TABS = [
  { id: "active", title: "회고.md", filePath: "/active.md", isDirty: false },
  { id: "resting", title: "읽는 법.md", filePath: "/resting.md", isDirty: false },
];

beforeEach(() => {
  useDocumentStore.setState({ tabs: TABS as never, activeTabId: "active" });
  useConflictStore.setState({ conflictTabIds: [] } as never);
  useMissingFileStore.setState({ missingTabIds: [] } as never);
});

afterEach(cleanup);

function tabAt(index: number): HTMLElement {
  const tab = document.querySelectorAll<HTMLElement>('[role="tab"]')[index];
  if (!tab) {
    throw new Error(`${String(index)}번 탭을 찾지 못했습니다`);
  }
  return tab;
}

it("활성 탭은 호버해도 배경이 그대로다", async () => {
  render(<TabBar />);
  const active = tabAt(0);
  const resting = getComputedStyle(active).backgroundColor;

  await userEvent.hover(active);

  expect(getComputedStyle(active).backgroundColor).toBe(resting);
});

// 위 테스트만 있으면 호버가 실제로 걸리지 않아도 통과한다 — 걸리는지를 여기가 확인한다.
it("비활성 탭은 호버하면 배경이 바뀐다", async () => {
  render(<TabBar />);
  const inactive = tabAt(1);
  const before = getComputedStyle(inactive).backgroundColor;

  await userEvent.hover(inactive);

  // 배경은 전환된다(→ decisions/motion.md) — 즉시 값이 아니라 전환 완료를 기다린다.
  await waitFor(() => {
    expect(getComputedStyle(inactive).backgroundColor).not.toBe(before);
  });
});
