import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { bracketMatching, defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import type { Extension } from "@codemirror/state";
import { EditorView, highlightActiveLine, keymap } from "@codemirror/view";

// M0 편집 확장 — 마크다운 하이라이팅 + 문서 내 검색 + 기본 편집/히스토리 키맵
// + 활성 줄 강조 + 브래킷 매칭. 산문 편집이므로 줄 바꿈(lineWrapping)을 기본으로 둔다.
// 폴딩(M4)·자동완성 등은 이후 마일스톤에서 더한다(→ .claude/docs/editor-strategy.md).
export function noriiEditorExtensions(): Extension[] {
  return [
    markdown(),
    syntaxHighlighting(defaultHighlightStyle),
    history(),
    highlightSelectionMatches(),
    highlightActiveLine(),
    bracketMatching(),
    EditorView.lineWrapping,
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
  ];
}
