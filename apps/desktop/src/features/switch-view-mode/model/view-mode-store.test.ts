import { beforeEach, describe, expect, it } from "vitest";

import { setViewMode, useViewModeStore } from "./view-mode-store";

// 왜: 뷰 모드는 편집 상태를 잃지 않고 화면 구성만 바꿔야 한다 — 그 전제가 되는
//     상태 전이를 여기서 고정한다.
//     "무엇을 보장하나" — 기본은 분할이고, 세 모드 사이를 자유로 오간다.
//     "경계" — 상태만 검증한다. 모드에 따라 어느 패널이 보이는지는 페이지 배선의 몫이고,
//     전환이 에디터 undo·커서를 보존하는지는 실앱에서 확인한다(언마운트 없이 숨기는 방식).
describe("view-mode-store", () => {
  beforeEach(() => {
    useViewModeStore.setState({ mode: "split" });
  });

  it("기본은 분할이다", () => {
    expect(useViewModeStore.getState().mode).toBe("split");
  });

  it("세 모드 사이를 오간다", () => {
    setViewMode("editor");
    expect(useViewModeStore.getState().mode).toBe("editor");
    setViewMode("preview");
    expect(useViewModeStore.getState().mode).toBe("preview");
    setViewMode("split");
    expect(useViewModeStore.getState().mode).toBe("split");
  });
});
