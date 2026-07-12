import { describe, expect, it } from "vitest";

import { blockIndexForLine, collectLineBlocks } from "./line-map";
import { renderMarkdown } from "./render";

// 집행: preview-strategy.md#스크롤-동기화 — 소스 라인 ↔ 렌더 블록 매핑 테이블.
//
// 왜: 스크롤 동기화는 "소스 몇째 줄이 프리뷰 어느 블록인가"를 알아야 한다. 렌더된 각
//     블록에 원본 라인 꼬리표(data-source-line)를 달고, 그것을 조회하는 테이블을 만든다.
// 보장: 블록 요소가 1-기반 시작/끝 라인을 담고(sanitize를 통과해 살아남고), 조회는
//       임의 라인에 대해 그 라인을 담당하는 블록을 돌려준다.
// 경계: 실제 스크롤 위치 계산·연동(feature, 단위 4)과 디바운스는 다루지 않는다.
//       인라인 요소 단위의 매핑은 목표가 아니다 — 블록 단위 근사가 사양이다.

function renderToDom(source: string): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = renderMarkdown(source);
  return host;
}

describe("renderMarkdown — data-source-line 주입", () => {
  it("블록 요소에 1-기반 시작 라인을 단다", () => {
    const host = renderToDom("# 제목\n\n본문 문단");
    expect(host.querySelector("h1")?.getAttribute("data-source-line")).toBe("1");
    expect(host.querySelector("p")?.getAttribute("data-source-line")).toBe("3");
  });

  it("여러 줄 블록은 끝 라인(data-source-line-end)도 담는다", () => {
    const host = renderToDom("첫 줄\n둘째 줄\n\n다음 문단");
    const paragraphs = host.querySelectorAll("p");
    expect(paragraphs[0]?.getAttribute("data-source-line")).toBe("1");
    expect(paragraphs[0]?.getAttribute("data-source-line-end")).toBe("2");
    expect(paragraphs[1]?.getAttribute("data-source-line")).toBe("4");
  });

  it("중첩 블록(리스트 아이템)에도 각자 라인이 달린다", () => {
    const host = renderToDom("- 하나\n- 둘\n- 셋");
    const items = host.querySelectorAll("li");
    expect(items[0]?.getAttribute("data-source-line")).toBe("1");
    expect(items[1]?.getAttribute("data-source-line")).toBe("2");
    expect(items[2]?.getAttribute("data-source-line")).toBe("3");
  });

  it("코드 펜스에도 라인이 달린다 — markdown-it fence 렌더러는 <code>에 속성을 그린다", () => {
    const host = renderToDom("본문\n\n```\ncode\n```");
    expect(host.querySelector("pre code")?.getAttribute("data-source-line")).toBe("3");
  });

  it("sanitize가 data-source-line을 깎지 않는다", () => {
    // DOMPurify 뒤에도 살아남아야 매핑이 성립한다 — 파이프라인 순서 회귀 방지.
    const html = renderMarkdown("# 제목");
    expect(html).toContain('data-source-line="1"');
  });
});

describe("collectLineBlocks — 매핑 테이블 수집", () => {
  it("data-source-line 요소를 문서 순서로 모은다", () => {
    const host = renderToDom("# 제목\n\n본문\n\n- 아이템");
    const blocks = collectLineBlocks(host);
    expect(blocks.map((block) => block.line)).toEqual([1, 3, 5, 5]);
    expect(blocks[0]?.element.tagName).toBe("H1");
  });

  it("매핑 대상이 없으면 빈 테이블이다", () => {
    const host = document.createElement("div");
    expect(collectLineBlocks(host)).toEqual([]);
  });
});

describe("blockIndexForLine — 라인 → 블록 조회", () => {
  // 시작 라인 [1, 5, 9]인 세 블록: 라인 L을 담당하는 블록은 "시작 라인 ≤ L인 마지막 블록"이다.
  const blocks = [{ line: 1 }, { line: 5 }, { line: 9 }];

  it("블록 시작 라인은 그 블록을 돌려준다", () => {
    expect(blockIndexForLine(blocks, 1)).toBe(0);
    expect(blockIndexForLine(blocks, 5)).toBe(1);
    expect(blockIndexForLine(blocks, 9)).toBe(2);
  });

  it("블록 사이 라인은 앞 블록을 돌려준다", () => {
    expect(blockIndexForLine(blocks, 4)).toBe(0);
    expect(blockIndexForLine(blocks, 7)).toBe(1);
  });

  it("첫 블록보다 앞이면 첫 블록, 끝을 넘으면 마지막 블록이다", () => {
    expect(blockIndexForLine(blocks, 0)).toBe(0);
    expect(blockIndexForLine(blocks, 100)).toBe(2);
  });

  it("빈 테이블이면 -1이다", () => {
    expect(blockIndexForLine([], 3)).toBe(-1);
  });
});
