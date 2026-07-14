import type MarkdownIt from "markdown-it";

// 콜아웃(GFM alerts) — 인용문의 첫 줄이 `[!NOTE]` 꼴이면 강조 상자로 표시한다
// (→ preview-strategy.md#콜아웃-gfm-alerts).
//
// 문법이 이미 마크다운이라는 것이 채택 근거다: `>`는 인용문이고 `[!NOTE]`는 그 안의 텍스트다.
// norii가 렌더하지 않는 에디터에서도 평범한 인용문으로 읽히므로 호환이 깨지지 않는다.
//
// 파서는 **클래스만** 붙인다. 아이콘·색·제목은 CSS의 몫이다 — 마크업으로 아이콘을 넣으면
// sanitize 허용 표면이 그만큼 늘고, 문서가 위조한 콜아웃도 아이콘을 갖게 된다.

/** GitHub 표준 5종. Obsidian의 독자 확장(추가 종류·접기)은 채택하지 않는다. */
export const CALLOUT_TYPES = ["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"] as const;

export type CalloutType = (typeof CALLOUT_TYPES)[number];

/** 상자의 클래스 접두 — 소비 측(CSS)이 이 이름으로 찾는다. */
export const CALLOUT_CLASS = "norii-callout";

// 첫 줄이 마커 하나로만 이뤄져야 한다 — "> 앞말\n> [!NOTE]"처럼 중간에 나오면 그냥 텍스트다.
const MARKER = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][^\S\n]*(\n|$)/i;

export function calloutPlugin(md: MarkdownIt): void {
  md.core.ruler.after("inline", "norii-callout", (state) => {
    const tokens = state.tokens;
    for (const [index, token] of tokens.entries()) {
      if (token.type !== "blockquote_open") {
        continue;
      }
      const paragraphOpen = tokens[index + 1];
      const inline = tokens[index + 2];
      if (paragraphOpen?.type !== "paragraph_open" || inline?.type !== "inline") {
        continue;
      }
      const match = MARKER.exec(inline.content);
      if (!match?.[1]) {
        continue;
      }
      const type = match[1].toLowerCase();
      token.attrJoin("class", `${CALLOUT_CLASS} ${CALLOUT_CLASS}-${type}`);

      // 마커는 화면에서 사라져야 한다 — 상자 자체가 종류를 말해 준다.
      // 인라인 토큰의 content와 이미 파싱된 자식 텍스트를 함께 자른다.
      inline.content = inline.content.slice(match[0].length);
      const first = inline.children?.[0];
      if (first?.type === "text") {
        first.content = first.content.slice(match[0].length);
      }
      // 마커 뒤에 오던 줄바꿈(softbreak)도 함께 지운다 — 상자 안이 빈 줄로 시작하지 않게.
      if (inline.children?.[0]?.type === "softbreak") {
        inline.children.shift();
      }
    }
  });
}
