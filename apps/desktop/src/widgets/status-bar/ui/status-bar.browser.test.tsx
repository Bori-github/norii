import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";

import "@app/index.css";

import type { Tab } from "@entities/document";
import { useDocumentStore } from "@entities/document";
import { useWorkspaceStore } from "@entities/workspace";

import { StatusBar } from "../index";

// 왜: 상태 바가 파일명만 보이면 같은 이름의 파일을 여러 폴더에서 열었을 때 어느 것을 보고 있는지
//     알 수 없다. 탭도 파일명만 그리므로 앱 어디에도 구분할 단서가 없다.
// 보장: 연 폴더와 파일 사이의 폴더 이름이 파일명 앞에 보인다. 사이에 폴더가 없거나 연 폴더가
//       없으면 아무것도 덧붙지 않는다. 자리가 모자라면 파일명보다 경로가 먼저 줄어든다.
// 경계: 경로를 어디까지 줄이는지의 폭은 보지 않는다 — 줄어드는 순서만 본다.

function openTab(filePath: string): void {
  const tab: Tab = {
    id: "tab-1",
    filePath,
    title: filePath.slice(filePath.lastIndexOf("/") + 1),
    isDirty: false,
    sourceEncoding: "utf-8",
    hasBom: false,
    eol: "lf",
    eolMixed: false,
    normalizationApproved: true,
    lastSavedHash: null,
  };
  useDocumentStore.setState({ tabs: [tab], activeTabId: tab.id });
}

beforeEach(() => {
  useDocumentStore.setState({ tabs: [], activeTabId: null });
  useWorkspaceStore.setState({ rootDir: null, fileTree: [], expandedDirs: [] });
});

afterEach(cleanup);

it("연 폴더와 파일 사이의 폴더 이름이 파일명 앞에 보인다", () => {
  useWorkspaceStore.getState().openRoot("/글", []);
  openTab("/글/회고/2026/회고.md");

  const { getByTestId } = render(<StatusBar />);
  expect(getByTestId("status-file-path").textContent).toBe("회고/2026/");
  expect(getByTestId("status-file-title").textContent).toBe("회고.md");
});

it("연 폴더 바로 아래 파일이면 경로를 덧붙이지 않는다", () => {
  useWorkspaceStore.getState().openRoot("/글", []);
  openTab("/글/할일.md");

  const { queryByTestId } = render(<StatusBar />);
  expect(queryByTestId("status-file-path")).toBeNull();
});

// 폴더를 열지 않고 파일만 연 경우 — 어느 폴더까지 보일지 정할 기준이 없다.
it("연 폴더가 없으면 경로를 덧붙이지 않는다", () => {
  openTab("/내려받기/회고/회고.md");

  const { queryByTestId } = render(<StatusBar />);
  expect(queryByTestId("status-file-path")).toBeNull();
});

it("자리가 모자라면 파일명보다 경로가 먼저 줄어든다", () => {
  useWorkspaceStore.getState().openRoot("/글", []);
  openTab("/글/회고/2026/상반기/돌아보며/회고.md");

  const { getByTestId } = render(
    <div style={{ width: 180 }}>
      <StatusBar />
    </div>,
  );
  const path = getByTestId("status-file-path");
  const title = getByTestId("status-file-title");

  expect(path.scrollWidth).toBeGreaterThan(path.clientWidth);
  expect(title.scrollWidth).toBeLessThanOrEqual(title.clientWidth);
});
