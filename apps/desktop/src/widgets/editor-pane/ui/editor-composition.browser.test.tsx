import { afterEach, expect, it } from "vitest";

import { createEditorView } from "@norii/editor";

import { EDITOR_COLORS } from "@shared/config";

// 집행: korean-ime.md#조합-확정-enter가-개행을-두-개-만든다 — 조합 종료 직후 Enter는 편집기가
//       직접 처리해 줄바꿈을 하나만 넣는다.
// 왜: 그대로 두면 WebKit이 pre-wrap 편집면에 개행 문자를 둘 넣고 CM6가 그것을 문서로 옮겨,
//     한글로 줄을 바꿀 때마다 빈 줄이 하나씩 쌓인다. 마크다운에서 빈 줄은 문단 분리라 저장된
//     파일과 프리뷰가 달라진다.
// 보장: 실제 WebKit에서 compositionend 직후의 Enter가 (1) 기본 동작을 막고 (2) 개행을 정확히
//       하나만 넣는다. 조합과 무관한 Enter는 편집기가 가로채지 않는다.
// 경계: 실제 IME 조합은 합성 이벤트로 만들 수 없다 — 여기서는 관측된 순서(compositionend →
//       keydown Enter)를 재현할 뿐이다. 실제 한국어 입력기로 친 결과는 실키 검증이 본다
//       (→ korean-ime.md#검증). 조합 확정 전용 Enter(일본어·중국어 변환)는 범위 밖이다.

let view: ReturnType<typeof createEditorView> | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
  view?.destroy();
  view = null;
  host?.remove();
  host = null;
});

function mount(doc: string): ReturnType<typeof createEditorView> {
  host = document.createElement("div");
  document.body.append(host);
  view = createEditorView({ parent: host, colors: EDITOR_COLORS, doc });
  view.focus();
  return view;
}

/** 조합이 끝난 직후를 재현한다 — 실제 IME가 보내는 순서(→ 파일 머리 경계). */
function endComposition(target: HTMLElement, data: string): void {
  target.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data }));
}

function pressEnter(target: HTMLElement): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key: "Enter",
    keyCode: 13,
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(event);
  return event;
}

it("조합 종료 직후 Enter는 개행을 하나만 넣는다", () => {
  const editor = mount("한");
  editor.dispatch({ selection: { anchor: editor.state.doc.length } });

  endComposition(editor.contentDOM, "한");
  const event = pressEnter(editor.contentDOM);

  expect(event.defaultPrevented).toBe(true);
  expect(editor.state.doc.toString()).toBe("한\n");
});

it("조합과 무관한 Enter도 개행은 하나뿐이다", () => {
  const editor = mount("한글");
  editor.dispatch({ selection: { anchor: editor.state.doc.length } });

  pressEnter(editor.contentDOM);

  // 조합 창 밖이면 기본 키맵만 돈다 — 이 확장까지 겹치면 여기서 개행이 둘이 된다.
  expect(editor.state.doc.toString()).toBe("한글\n");
});
