import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";

import "@app/index.css";

import { useDocumentStore } from "@entities/document";
import { useConflictStore, useMissingFileStore } from "@features/save-file";

import { TabBar } from "./tab-bar";

// 왜: 한 탭이 저장 대기이면서 충돌일 수 있다. 자리도 모양도 하나라 어느 쪽을 보일지 정해 두지
//     않으면 상황마다 다르게 나온다(→ decisions/color-palette#탭-상태-점).
// 보장: 점은 탭마다 최대 하나고, 겹치면 충돌이 이긴다. 깨끗한 탭에는 없다.
// 경계: 점의 크기·테두리 값은 여기서 보지 않는다 — 화면에 칠해진 색만 본다.

const TABS = [
  { id: "clean", title: "읽는 법.md", filePath: "/clean.md", isDirty: false },
  { id: "pending", title: "회고.md", filePath: "/pending.md", isDirty: true },
  { id: "both", title: "충돌난-메모.md", filePath: "/both.md", isDirty: true },
];

beforeEach(() => {
  useDocumentStore.setState({ tabs: TABS as never, activeTabId: "pending" });
  useConflictStore.setState({ conflictTabIds: [] } as never);
  useMissingFileStore.setState({ missingTabIds: [] } as never);
});

afterEach(cleanup);

function token(name: string): string {
  const hex = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const [, r, g, b] = /^#(\w{2})(\w{2})(\w{2})$/.exec(hex) ?? [];
  if (r === undefined || g === undefined || b === undefined) {
    throw new Error(`${name}을(를) 읽지 못했습니다: ${hex}`);
  }
  return `rgb(${Number.parseInt(r, 16)}, ${Number.parseInt(g, 16)}, ${Number.parseInt(b, 16)})`;
}

function dots(container: HTMLElement): string[] {
  return [...container.querySelectorAll("[data-status]")].map(
    (dot) => `${dot.getAttribute("data-status")}:${getComputedStyle(dot).backgroundColor}`,
  );
}

it("저장 대기는 액센트로 칠하고, 깨끗한 탭에는 점이 없다", () => {
  const { container } = render(<TabBar />);
  const accent = `pending:${token("--colors-accent")}`;
  expect(dots(container)).toEqual([accent, accent]);
});

it("저장 대기이면서 충돌이면 충돌만 보인다", () => {
  useConflictStore.setState({ conflictTabIds: ["both"] } as never);
  const { container } = render(<TabBar />);
  expect(dots(container)).toEqual([
    `pending:${token("--colors-accent")}`,
    `alerted:${token("--colors-status-danger")}`,
  ]);
});

it("파일이 사라진 탭도 충돌과 같은 표시를 쓴다", () => {
  useMissingFileStore.setState({ missingTabIds: ["both"] } as never);
  const { container } = render(<TabBar />);
  expect(dots(container).at(-1)).toBe(`alerted:${token("--colors-status-danger")}`);
});
