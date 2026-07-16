import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { bracketMatching } from "@codemirror/language";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import type { Extension } from "@codemirror/state";
import { EditorView, highlightActiveLine, keymap, scrollPastEnd } from "@codemirror/view";

import { noriiTheme, type EditorColors } from "./theme";

// M0 편집 확장 — 마크다운 하이라이팅 + 문서 내 검색 + 기본 편집/히스토리 키맵
// + 활성 줄 강조 + 브래킷 매칭. 산문 편집이므로 줄 바꿈(lineWrapping)을 기본으로 둔다.
// scrollPastEnd: 마지막 줄을 화면 상단까지 올릴 수 있는 바닥 여백(VS Code
// scrollBeyondLastLine과 같은 관례) — 문서 끝 편집 시 커서가 바닥에 붙지 않는다.
// 폴딩(M5)·자동완성 등은 이후 마일스톤에서 더한다(→ .claude/docs/editor-strategy.md).
//
// 테마는 **주입받는다** — CM6 기본 테마를 쓰면 앱 팔레트 밖 색(파란 활성 줄·회색 검색 패널)이
// 화면에 남는다. 색의 단일 출처는 앱의 디자인 토큰이다(→ design/design-system.md#테마-라이트다크).
export function noriiEditorExtensions(colors: EditorColors): Extension[] {
  return [
    markdown(),
    ...noriiTheme(colors),
    history(),
    highlightSelectionMatches(),
    highlightActiveLine(),
    bracketMatching(),
    EditorView.lineWrapping,
    scrollPastEnd(),
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
  ];
}
