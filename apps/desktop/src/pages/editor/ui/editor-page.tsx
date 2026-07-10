import { EditorPane } from "@widgets/editor-pane";

// 에디터 화면 — M0에서는 에디터 패널 하나만 조합한다.
// M3~M4에서 사이드바·프리뷰 패널이 여기 함께 배치된다(→ .claude/docs/implementation-plan.md).
export function EditorPage() {
  return <EditorPane />;
}
