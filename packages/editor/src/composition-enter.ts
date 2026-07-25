import { insertNewlineAndIndent } from "@codemirror/commands";
import type { Extension } from "@codemirror/state";
import { EditorView, ViewPlugin } from "@codemirror/view";

// 조합 확정 Enter — 사실과 근거는 .claude/docs/korean-ime.md가 소유한다.
//
// CM6는 조합 직후의 키를 이벤트 배분 단계에서 걸러내므로(inputState.ignoreDuringComposition)
// domEventHandlers·keymap으로는 이 Enter를 볼 수 없다. contentDOM에 직접 건다.
const COMPOSITION_KEY_WINDOW_MS = 100;

export function compositionEnter(): Extension {
  return ViewPlugin.define((view: EditorView) => {
    let endedAt = 0;

    const onCompositionEnd = (): void => {
      endedAt = Date.now();
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Enter" || event.defaultPrevented) {
        return;
      }
      if (Date.now() - endedAt > COMPOSITION_KEY_WINDOW_MS) {
        return;
      }
      endedAt = 0;
      event.preventDefault();
      insertNewlineAndIndent(view);
    };

    view.contentDOM.addEventListener("compositionend", onCompositionEnd, true);
    view.contentDOM.addEventListener("keydown", onKeyDown, true);

    return {
      destroy(): void {
        view.contentDOM.removeEventListener("compositionend", onCompositionEnd, true);
        view.contentDOM.removeEventListener("keydown", onKeyDown, true);
      },
    };
  });
}
