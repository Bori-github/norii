import type { EditorView } from "@codemirror/view";

// 스크롤 동기화용 뷰포트↔라인 변환 — 소비 측(앱의 scroll-sync feature)이
// "라인 + 라인 블록 내 진행률(0~1)" 좌표로 두 패널을 잇는다.

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** 뷰포트 상단에 걸친 소스 라인(1-기반)과 그 라인 블록 내 진행률. */
export function topVisibleLine(view: EditorView): { line: number; fraction: number } {
  const top = view.scrollDOM.scrollTop;
  const block = view.lineBlockAtHeight(top);
  const line = view.state.doc.lineAt(block.from).number;
  const fraction = block.height > 0 ? clamp((top - block.top) / block.height, 0, 1) : 0;
  return { line, fraction };
}

/** 해당 라인이 뷰포트 상단에 오는 scrollTop 목표값. 라인은 문서 범위로 클램프한다. */
export function lineScrollTop(view: EditorView, line: number, fraction = 0): number {
  const clamped = clamp(Math.floor(line), 1, view.state.doc.lines);
  const block = view.lineBlockAt(view.state.doc.line(clamped).from);
  return block.top + block.height * clamp(fraction, 0, 1);
}
