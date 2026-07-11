import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

import { noriiEditorExtensions } from "./extensions";

export interface CreateEditorStateOptions {
  /** 초기 문서 내용. 생략하면 빈 문서. */
  doc?: string;
  /**
   * 문서 내용이 실제로 바뀔 때(docChanged) 호출된다 — dirty 추적·자동 저장 예약의 신호
   * (→ .claude/docs/file-lifecycle.md의 Dirty 추적). 텍스트를 넘기지 않는 것은 의도다:
   * 매 키 입력마다 전체 문서를 문자열화하지 않고, 소비 측이 필요할 때 view에서 읽는다.
   */
  onDocChanged?: () => void;
}

// 에디터 상태의 단일 생성 지점 — 확장 구성을 한곳에 모아 앱·위젯이 일관되게 소비한다.
export function createEditorState(options: CreateEditorStateOptions = {}): EditorState {
  const { onDocChanged } = options;
  const extensions = [...noriiEditorExtensions()];
  if (onDocChanged) {
    extensions.push(
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onDocChanged();
        }
      }),
    );
  }
  return EditorState.create({
    doc: options.doc ?? "",
    extensions,
  });
}
