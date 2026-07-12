import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";

// CM6 테마 — 앱 UI와 **하나의 토큰 출처**를 쓴다(→ .claude/docs/design/design-system.md#테마-라이트다크).
// 이 패키지는 플랫폼·프레임워크 무관이므로 토큰을 직접 읽지 않고 **색 문자열을 주입받는다.**
// 소비 측(apps/desktop)이 CSS 변수 참조(`var(--colors-bg-paper)`)를 넘기면 테마 전환 시
// 에디터를 다시 만들지 않아도 색이 따라온다 — 브라우저가 변수를 다시 풀기 때문이다.

export interface EditorColors {
  /** 글이 놓이는 면. 불투명이어야 한다 — 유리를 켜면 본문 뒤로 바탕화면이 지나간다. */
  paper: string;
  /** 본문 글자. */
  text: string;
  /** 흐린 글자 — 인용·구분자 등 부차적 요소. */
  muted: string;
  /** 마크다운 구문 마크(#, -, **, 링크). 글자이므로 AA를 만족하는 색이어야 한다. */
  mark: string;
  /** 액센트 — 커서에만 쓴다. 글자에는 쓰지 않는다(→ decisions/0005). */
  accent: string;
  /** 선택 영역·활성 줄 배경. */
  hover: string;
  /** 경계선. */
  border: string;
}

// 마크다운 구문 강조 — **색보다 굵기·기울기로** 구조를 드러낸다.
// 액센트를 글자로 쓸 수 없으므로(테마 공통 단일 값 → 한 테마에서 AA 미달) 색은 mark 하나만 쓴다.
export function markdownHighlightSpec(colors: EditorColors) {
  return [
    { tag: tags.heading, color: colors.text, fontWeight: "bold" },
    { tag: tags.strong, fontWeight: "bold" },
    { tag: tags.emphasis, fontStyle: "italic" },
    { tag: tags.strikethrough, textDecoration: "line-through" },
    // 마크(#, -, >, **, 백틱)와 링크 — 본문과 구별되는 유일한 색.
    { tag: tags.processingInstruction, color: colors.mark },
    { tag: tags.link, color: colors.mark, textDecoration: "underline" },
    { tag: tags.url, color: colors.mark },
    { tag: tags.monospace, color: colors.mark },
    // 인용은 흐리게 — 본문보다 물러난다.
    { tag: tags.quote, color: colors.muted },
    { tag: tags.contentSeparator, color: colors.muted },
  ];
}

/**
 * norii 에디터 테마. 색을 주입받아 CM6 기본 테마(파란 활성 줄·회색 검색 패널)를 전부 덮는다 —
 * 하나라도 남기면 화면에 앱 팔레트 밖 색이 남는다.
 */
export function editorThemeSpec(colors: EditorColors): Record<string, Record<string, string>> {
  return {
    "&": {
      backgroundColor: colors.paper,
      color: colors.text,
    },
    // 편집면은 종이다 — 배경을 명시적으로 칠한다(→ decisions/0001).
    ".cm-content": {
      caretColor: colors.accent,
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: colors.accent,
      borderLeftWidth: "2px",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: colors.hover,
    },
    // CM6 기본값은 옅은 파랑(#cceeff)이다 — 팔레트 밖 색이라 반드시 덮는다.
    ".cm-activeLine": {
      backgroundColor: colors.hover,
    },
    ".cm-selectionMatch": {
      backgroundColor: colors.hover,
      outline: `1px solid ${colors.border}`,
    },
    ".cm-searchMatch": {
      backgroundColor: colors.hover,
      outline: `1px solid ${colors.accent}`,
    },
    ".cm-searchMatch.cm-searchMatch-selected": {
      backgroundColor: colors.hover,
      outline: `2px solid ${colors.accent}`,
    },
    // 검색 패널은 content 위에 놓인 크롬이다 — 뒤에 있는 것이 바탕화면이 아니라 글이므로
    // **불투명**해야 한다(→ decisions/0001). CM6 기본값은 #f5f5f5 하드코딩이다.
    ".cm-panels": {
      backgroundColor: colors.paper,
      color: colors.text,
    },
    ".cm-panels.cm-panels-bottom": {
      borderTop: `1px solid ${colors.border}`,
    },
    ".cm-panels.cm-panels-top": {
      borderBottom: `1px solid ${colors.border}`,
    },
    ".cm-panel input, .cm-panel button": {
      backgroundColor: colors.paper,
      color: colors.text,
      border: `1px solid ${colors.border}`,
      borderRadius: "3px",
    },
    ".cm-panel button:hover": {
      backgroundColor: colors.hover,
    },
    ".cm-panel label": {
      color: colors.muted,
    },
    ".cm-gutters": {
      backgroundColor: colors.paper,
      color: colors.muted,
      border: "none",
    },
    ".cm-activeLineGutter": {
      backgroundColor: colors.hover,
    },
    ".cm-matchingBracket, .cm-nonmatchingBracket": {
      backgroundColor: colors.hover,
      outline: `1px solid ${colors.border}`,
    },
  };
}

/**
 * norii 에디터 테마. 색을 주입받아 CM6 기본 테마(파란 활성 줄·회색 검색 패널)를 전부 덮는다 —
 * 하나라도 남기면 화면에 앱 팔레트 밖 색이 남는다.
 */
export function noriiTheme(colors: EditorColors): Extension[] {
  return [
    EditorView.theme(editorThemeSpec(colors)),
    syntaxHighlighting(HighlightStyle.define(markdownHighlightSpec(colors))),
  ];
}
