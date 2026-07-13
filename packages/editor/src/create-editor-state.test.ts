import { undo } from "@codemirror/commands";
import { language } from "@codemirror/language";
import { describe, expect, it } from "vitest";

import { createEditorState } from "./create-editor-state";
import type { EditorColors } from "./theme";

// 왜: 에디터 상태 팩토리는 앱·위젯이 의존하는 계약이다.
//     "무엇을 보장하나" — 문서 내용 반영 · 마크다운 언어 구성(하이라이팅 전제) · 편집 히스토리.
//     "경계" — DOM 없는 순수 상태만 검증한다. 렌더·키 입력은 상위 레이어 브라우저 테스트가 맡는다.
//     테마가 실제로 어떤 픽셀을 그리는지도 여기서 검증하지 않는다 — 실앱에서 관찰한다.

// 테스트용 색 — 실제 앱은 CSS 변수 참조를 넘긴다(→ apps/desktop/src/shared/config/editor-colors.ts).
const COLORS: EditorColors = {
  paper: "#ffffff",
  text: "#000000",
  muted: "#666666",
  mark: "#336633",
  accent: "#568335",
  hover: "rgba(0, 0, 0, 0.06)",
  selection: "rgba(86, 131, 53, 0.28)",
  match: "rgba(86, 131, 53, 0.14)",
  border: "rgba(0, 0, 0, 0.12)",
};

describe("createEditorState", () => {
  it("주어진 문서 내용으로 상태를 만든다", () => {
    const state = createEditorState({ colors: COLORS, doc: "# 제목" });
    expect(state.doc.toString()).toBe("# 제목");
  });

  it("문서를 주지 않으면 빈 문서로 시작한다", () => {
    expect(createEditorState({ colors: COLORS }).doc.toString()).toBe("");
  });

  it("마크다운 언어를 구성한다 (구문 하이라이팅의 전제)", () => {
    const state = createEditorState({ colors: COLORS, doc: "**굵게**" });
    expect(state.facet(language)?.name).toBe("markdown");
  });

  it("편집 히스토리를 지원한다 — 실행 취소가 원문을 되돌린다", () => {
    let state = createEditorState({ colors: COLORS, doc: "" });
    state = state.update({ changes: { from: 0, insert: "안녕" } }).state;
    expect(state.doc.toString()).toBe("안녕");

    undo({
      state,
      dispatch: (transaction) => {
        state = transaction.state;
      },
    });
    expect(state.doc.toString()).toBe("");
  });
});
