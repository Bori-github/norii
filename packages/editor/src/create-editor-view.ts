import { EditorView } from "@codemirror/view";

import { createEditorState } from "./create-editor-state";

export interface CreateEditorViewOptions {
  /** 에디터를 마운트할 DOM 요소. */
  parent: HTMLElement;
  /** 초기 문서 내용. */
  doc?: string;
}

// DOM에 에디터를 마운트한다. 소비 측(위젯)은 반환된 view의 destroy로 정리한다.
export function createEditorView(options: CreateEditorViewOptions): EditorView {
  return new EditorView({
    state: createEditorState({ doc: options.doc }),
    parent: options.parent,
  });
}
