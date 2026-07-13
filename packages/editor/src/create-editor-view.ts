import { EditorView } from "@codemirror/view";

import { createEditorState } from "./create-editor-state";
import type { EditorColors } from "./theme";

export interface CreateEditorViewOptions {
  /** 에디터를 마운트할 DOM 요소. */
  parent: HTMLElement;
  /** 에디터 색 — 앱의 디자인 토큰에서 온다(→ CreateEditorStateOptions 참조). */
  colors: EditorColors;
  /** 초기 문서 내용. */
  doc?: string;
  /** 문서 변경(docChanged) 콜백 — 상세는 CreateEditorStateOptions 참조. */
  onDocChanged?: () => void;
}

// DOM에 에디터를 마운트한다. 소비 측(위젯)은 반환된 view의 destroy로 정리한다.
export function createEditorView(options: CreateEditorViewOptions): EditorView {
  return new EditorView({
    state: createEditorState({
      colors: options.colors,
      doc: options.doc,
      onDocChanged: options.onDocChanged,
    }),
    parent: options.parent,
  });
}
