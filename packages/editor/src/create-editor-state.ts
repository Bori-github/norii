import { EditorState } from "@codemirror/state";

import { noriiEditorExtensions } from "./extensions";

export interface CreateEditorStateOptions {
  /** 초기 문서 내용. 생략하면 빈 문서. */
  doc?: string;
}

// 에디터 상태의 단일 생성 지점 — 확장 구성을 한곳에 모아 앱·위젯이 일관되게 소비한다.
export function createEditorState(options: CreateEditorStateOptions = {}): EditorState {
  return EditorState.create({
    doc: options.doc ?? "",
    extensions: noriiEditorExtensions(),
  });
}
