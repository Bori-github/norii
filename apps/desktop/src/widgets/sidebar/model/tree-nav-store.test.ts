import { beforeEach, describe, expect, it } from "vitest";

import { resetTreeNav, setTreeNavCurrent, useTreeNavStore } from "./tree-nav-store";

// 왜: roving tabindex는 "보이는 노드 중 정확히 하나가 Tab 정지점"이어야 성립한다 —
//     그 하나를 가리키는 값의 전이를 고정한다. 어긋나면 Tab이 트리를 건너뛰거나 여러 곳이
//     정지점이 된다.
// 보장: 기본은 없음(null), 지정하면 그 경로가 현재가 되고, 리셋하면 없음으로 돌아간다.
// 경계: "그 경로가 실제로 보이는 노드인가"·화살표 이동은 sidebar 배선의 몫이다
//       (sidebar.browser.test). 여기는 값 하나의 전이만 본다.
describe("tree-nav-store", () => {
  beforeEach(() => {
    resetTreeNav();
  });

  it("기본은 정지점 없음이다", () => {
    expect(useTreeNavStore.getState().currentPath).toBeNull();
  });

  it("현재 경로를 지정·교체한다", () => {
    setTreeNavCurrent("/vault/a.md");
    expect(useTreeNavStore.getState().currentPath).toBe("/vault/a.md");
    setTreeNavCurrent("/vault/b.md");
    expect(useTreeNavStore.getState().currentPath).toBe("/vault/b.md");
  });

  it("리셋하면 없음으로 돌아간다", () => {
    setTreeNavCurrent("/vault/a.md");
    resetTreeNav();
    expect(useTreeNavStore.getState().currentPath).toBeNull();
  });
});
