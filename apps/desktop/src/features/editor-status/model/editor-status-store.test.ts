import { beforeEach, describe, expect, it } from "vitest";

import {
  clearEditorStatus,
  reportChars,
  reportCursor,
  useEditorStatusStore,
} from "./editor-status-store";

// 왜: 상태바는 이 스토어의 null 여부로 표시/숨김을 가른다 — 그 전제가 되는 상태 전이를 고정한다.
//     "무엇을 보장하나" — 보고 전에는 null이고, 보고가 값을 채우며, 청소가 null로 되돌린다.
//     "경계" — 누가 언제 보고하는지(에디터 배선·디바운스)는 실앱 검증 대상이다.
describe("editor-status-store", () => {
  beforeEach(() => {
    clearEditorStatus();
  });

  it("보고 전에는 커서·자 수가 없다", () => {
    expect(useEditorStatusStore.getState()).toEqual({ cursor: null, chars: null });
  });

  it("보고가 값을 채운다", () => {
    reportCursor({ line: 3, column: 7 });
    reportChars(42);
    expect(useEditorStatusStore.getState()).toEqual({ cursor: { line: 3, column: 7 }, chars: 42 });
  });

  it("청소가 둘 다 null로 되돌린다 — 탭이 모두 닫힌 상태", () => {
    reportCursor({ line: 1, column: 1 });
    reportChars(1);
    clearEditorStatus();
    expect(useEditorStatusStore.getState()).toEqual({ cursor: null, chars: null });
  });
});
