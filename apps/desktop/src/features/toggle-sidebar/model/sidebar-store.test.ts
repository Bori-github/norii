import { beforeEach, describe, expect, it } from "vitest";

import { setSidebarVisible, toggleSidebar, useSidebarStore } from "./sidebar-store";

// 왜: 접기가 트리 상태를 함께 건드리면 접기가 "닫았다 열기"가 된다. 그 전제인
//     보임/숨김 한 값만의 전이를 고정한다.
// 보장: 기본은 보임이고, 토글은 매번 뒤집고, 값 지정은 뒤집지 않고 그 값이 된다
//       (저장값 복원은 뒤집기로 할 수 없다 → .claude/docs/file-lifecycle.md#설정-저장).
// 경계: 이 스토어는 보임/숨김만 안다. 사이드바가 화면에서 사라지는지는 페이지 배선의
//       몫이고(editor-page.browser.test), 트리 펼침 상태 보존은 스토어가 분리되어
//       있다는 사실로 성립한다(→ document-model.md#파일-트리-사이드바).
describe("sidebar-store", () => {
  beforeEach(() => {
    useSidebarStore.setState({ visible: true });
  });

  it("기본은 보임이다", () => {
    expect(useSidebarStore.getState().visible).toBe(true);
  });

  it("토글은 매번 뒤집는다", () => {
    toggleSidebar();
    expect(useSidebarStore.getState().visible).toBe(false);
    toggleSidebar();
    expect(useSidebarStore.getState().visible).toBe(true);
  });

  it("값을 지정하면 지금 상태와 무관하게 그 값이 된다", () => {
    setSidebarVisible(true);
    expect(useSidebarStore.getState().visible).toBe(true);
    setSidebarVisible(false);
    expect(useSidebarStore.getState().visible).toBe(false);
  });
});
