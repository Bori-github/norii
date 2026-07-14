import type MarkdownIt from "markdown-it";

// 헤딩 앵커 — 헤딩에 slug id를 붙인다(→ preview-strategy.md#헤딩-앵커).
//
// markdown-it은 헤딩에 id를 붙이지 않는다. 그래서 목차 링크(`[개요](#개요)`)가 가리킬 대상이
// 없어 링크가 죽어 있다. 규칙은 **GitHub 호환**으로 맞춘다 — 사용자가 GitHub에서 쓰던 목차가
// norii에서도 그대로 동작해야 하기 때문이다.

// 남기는 것: 유니코드 글자·숫자·하이픈·밑줄. 나머지(문장 부호·기호)는 버린다.
// 한글을 남기는 것이 중요하다 — 버리면 한글 제목의 slug가 전부 빈 문자열이 된다.
const DROPPED = /[^\p{L}\p{N}\-_]/gu;
const WHITESPACE = /\s+/gu;

/** 헤딩 텍스트 → slug. 남는 글자가 없으면 빈 문자열이며, 대체 id는 호출 측이 정한다. */
export function slugify(text: string): string {
  return text.trim().toLowerCase().replace(WHITESPACE, "-").replace(DROPPED, "");
}

export function headingAnchorPlugin(md: MarkdownIt): void {
  md.core.ruler.push("norii-heading-anchor", (state) => {
    // 번호는 **문서 하나 안에서만** 센다 — 모듈 수준에 두면 렌더를 거듭할수록 번호가 자라
    // 같은 문서가 매번 다른 id를 갖게 된다(앵커가 재렌더마다 끊긴다).
    const used = new Map<string, number>();

    for (const [index, token] of state.tokens.entries()) {
      if (token.type !== "heading_open") {
        continue;
      }
      const inline = state.tokens[index + 1];
      const text = inline?.type === "inline" ? inline.content : "";
      // 글자가 하나도 남지 않는 제목(예: "# !!!")도 앵커의 대상이 될 수 있어야 하므로
      // 자리 번호로 대체한다 — id 없는 헤딩을 남기지 않는다.
      const base = slugify(text) || `section-${index}`;
      const seen = used.get(base) ?? 0;
      used.set(base, seen + 1);
      token.attrSet("id", seen === 0 ? base : `${base}-${seen}`);
    }
  });
}
