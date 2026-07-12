import type MarkdownIt from "markdown-it";

// 소스 라인 ↔ 렌더 블록 매핑 테이블(→ preview-strategy.md#스크롤-동기화).
// markdown-it의 token.map(0-기반, 끝 배타)을 1-기반 라인으로 바꿔 블록 요소에 단다 —
// CM6의 라인 번호(1-기반)와 맞춰 소비 측 변환을 없앤다.
// 인라인 단위 매핑은 목표가 아니다 — 블록 단위 근사가 사양이다.

/** 렌더된 블록 토큰에 data-source-line(시작)·data-source-line-end(끝, 포함)를 주입한다. */
export function sourceLinePlugin(md: MarkdownIt): void {
  md.core.ruler.push("norii-source-line", (state) => {
    for (const token of state.tokens) {
      // 여는 토큰(nesting 1)과 자기완결 토큰(fence·hr, nesting 0)만 대상.
      // hidden 토큰(타이트 리스트의 문단)은 렌더되지 않으므로 제외한다.
      if (!token.map || token.nesting < 0 || token.hidden) {
        continue;
      }
      token.attrSet("data-source-line", String(token.map[0] + 1));
      token.attrSet("data-source-line-end", String(token.map[1]));
    }
  });
}

export interface LineBlock {
  /** 블록이 시작하는 소스 라인 (1-기반). */
  line: number;
  /** 블록이 끝나는 소스 라인 (1-기반, 포함). */
  endLine: number;
  element: HTMLElement;
}

/** 렌더된 프리뷰 DOM에서 매핑 테이블을 문서 순서로 수집한다. */
export function collectLineBlocks(root: ParentNode): LineBlock[] {
  return Array.from(root.querySelectorAll<HTMLElement>("[data-source-line]")).map((element) => {
    const line = Number(element.dataset["sourceLine"]);
    const end = element.dataset["sourceLineEnd"];
    return { line, endLine: end === undefined ? line : Number(end), element };
  });
}

/**
 * 라인을 담당하는 블록 인덱스 — "시작 라인 ≤ line인 마지막 블록"(이진 탐색).
 * 첫 블록보다 앞이면 첫 블록, 빈 테이블이면 -1.
 */
export function blockIndexForLine(blocks: readonly { line: number }[], line: number): number {
  if (blocks.length === 0) {
    return -1;
  }
  let low = 0;
  let high = blocks.length - 1;
  let found = 0;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const block = blocks[mid];
    if (block !== undefined && block.line <= line) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found;
}
