import { describe, expect, it } from "vitest";

import { renderMarkdown } from "./render";

// 집행: preview-strategy.md#수식다이어그램-지원-채택 — 각주(markdown-it-footnote)와
// 수식(@vscode/markdown-it-katex)은 markdown-it 플러그인으로 붙는다.
//
// 왜: 둘 다 sanitize와 정면으로 부딪힌다. KaTeX는 MathML을 뱉는데 DOMPurify가 그 마크업을
//     깎으면 수식이 깨진 채 남고, 각주는 문서 안을 오가는 링크(#fn1)를 만드는데 그 앵커가
//     정화에 걸리면 각주가 죽는다. "렌더된다"가 아니라 "**정화를 통과해** 렌더된다"가 사양이다.
// 보장: 인라인·블록 수식이 KaTeX 마크업으로 나오고, 각주가 본문 참조와 하단 목록으로 갈라지며,
//       셋 다 DOMPurify를 지난 결과에서 살아남는다. 수식이 아닌 $는 건드리지 않는다.
// 경계: 수식의 조판 정확도는 KaTeX의 책임이라 다루지 않는다. CSS·폰트 번들은 소비 측 몫이다.
describe("수식 (KaTeX)", () => {
  it("인라인 수식($…$)을 KaTeX 마크업으로 렌더한다", () => {
    const html = renderMarkdown("공식은 $E = mc^2$ 이다");
    expect(html).toContain("katex");
    // 원문($ 사이의 텍스트)이 그대로 남으면 수식이 아니라 문자열로 나온 것이다.
    expect(html).not.toContain("$E = mc^2$");
  });

  it("블록 수식($$…$$)을 렌더한다", () => {
    const html = renderMarkdown("$$\n\\int_0^1 x\\,dx\n$$");
    // 조판이 실패하면 KaTeX가 katex-error를 남긴다 — 렌더됐다는 것은 그것이 없다는 뜻이다.
    expect(html).toContain("katex-display");
    expect(html).not.toContain("katex-error");
  });

  it("제어 시퀀스(\\frac·\\int)가 동작한다 — katex의 CJS 빌드가 깨지던 지점", () => {
    // 회귀 방어: 번들러가 katex의 CJS 빌드를 잡으면 함수 등록이 날아가 모든 제어 시퀀스가
    // "Undefined control sequence"가 된다(수식 전체가 죽는다). ESM 빌드 고정이 그 방어다
    // (→ vite/vitest 설정의 katex alias).
    expect(renderMarkdown("$\\frac{1}{2}$")).not.toContain("katex-error");
    expect(renderMarkdown("$$\n\\int_0^1 x\\,dx\n$$")).not.toContain("katex-error");
  });

  it("KaTeX의 MathML이 sanitize를 통과한다 — 접근성 트리가 수식을 읽는 근거", () => {
    // KaTeX는 눈으로 보는 HTML과 스크린리더가 읽는 MathML을 함께 낸다. DOMPurify가 MathML을
    // 깎으면 보이기는 해도 읽히지 않는 수식이 된다.
    const html = renderMarkdown("$x^2$");
    expect(html).toContain("<math");
    expect(html).toContain("annotation");
  });

  it("수식이 아닌 $는 건드리지 않는다 — 가격 표기가 수식으로 둔갑하지 않는다", () => {
    const html = renderMarkdown("가격은 $5 이고 배송비는 $3 이다");
    expect(html).not.toContain("katex");
    expect(html).toContain("$5");
  });

  it("문법이 틀린 수식은 문서를 깨지 않는다 — 그 자리에만 오류로 남는다", () => {
    const html = renderMarkdown("$\\frac{1}{$");
    expect(html).toContain("<p");
  });

  it("사용자가 지정한 크기는 상한에서 잘린다 — 수식 하나가 문서 레이아웃을 폭파하지 못한다", () => {
    // KaTeX의 maxSize 기본값은 Infinity다 — \rule{9999em}{9999em} 하나로 문서 높이가
    // 수백만 px이 되어 레이아웃·스크롤 동기화가 무너진다. 상한이 걸리면 **렌더되는**
    // 크기(스타일 값·MathML 속성)가 잘린다. annotation의 TeX 원문에는 지정값이 남는 것이
    // 정상이다(스크린리더용 원문 보존).
    const html = renderMarkdown("$\\rule{9999em}{9999em}$");
    expect(html).not.toContain(":9999em"); // style="height:9999em" 꼴
    expect(html).not.toContain('"9999em"'); // width="9999em" 속성 꼴
    expect(html).toContain(":100em"); // 상한값으로 실제로 잘렸다
  });
});

describe("각주", () => {
  it("각주 참조와 하단 목록을 만든다", () => {
    const html = renderMarkdown("본문[^1]\n\n[^1]: 각주 내용");
    // 본문에는 위첨자 참조가, 문서 끝에는 각주 목록이 생긴다.
    expect(html).toContain("<sup");
    expect(html).toContain("각주 내용");
    expect(html).toMatch(/class="footnotes/);
  });

  it("참조와 목록이 서로를 가리키는 앵커로 이어진다 — sanitize가 링크를 깎지 않는다", () => {
    const html = renderMarkdown("본문[^1]\n\n[^1]: 각주 내용");
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const ref = parsed.querySelector("sup a");
    const href = ref?.getAttribute("href");
    expect(href).toMatch(/^#/);
    // 가리키는 대상이 실제로 문서 안에 있어야 각주가 동작한다(id가 정화에 살아남았는가).
    expect(parsed.querySelector(String(href))).not.toBeNull();
  });

  it("정의되지 않은 각주 참조는 일반 텍스트다", () => {
    const html = renderMarkdown("본문[^없음]");
    expect(html).toContain("[^없음]");
    expect(html).not.toContain("footnotes");
  });
});
