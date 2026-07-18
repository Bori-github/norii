import { codeFolding, foldGutter, foldKeymap } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { keymap } from "@codemirror/view";

// 마크다운 접기 — 단일 출처: .claude/docs/editor-strategy.md#하이브리드-접기-아웃라이너-대체.
// 접기 "규칙"(헤딩 섹션·리스트 항목·블록)은 lang-markdown이 내장한다 — 여기는 접기
// UI(접힘 상태·placeholder·거터 토글)와 기본 foldKeymap(단축키 계약)을 켤 뿐이다.
// 내장 동작은 folding.test.ts가 계약으로 고정한다(업스트림 변화 감지).
// 접기는 순전히 에디터 표현이다 — .md 내용을 바꾸지 않는다(경계 규칙 → non-goals.md).
export function markdownFolding(): Extension[] {
  return [codeFolding(), foldGutter(), keymap.of(foldKeymap)];
}
