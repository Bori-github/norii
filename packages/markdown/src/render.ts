import katexPlugin from "@vscode/markdown-it-katex";
import DOMPurify from "dompurify";
import MarkdownIt from "markdown-it";
import footnotePlugin from "markdown-it-footnote";

import { calloutPlugin } from "./callout";
import { headingAnchorPlugin } from "./heading-anchor";
import { sourceLinePlugin } from "./line-map";
import { mermaidFencePlugin } from "./mermaid";

// 프리뷰 파이프라인 — 소스 텍스트 → markdown-it(GFM) → DOMPurify sanitize → HTML 문자열.
// DOM 삽입은 소비 측(apps/desktop)이 담당한다(→ .claude/docs/preview-strategy.md).
//
// sanitize는 옵션이 아니라 필수다: 마크다운은 원시 HTML을 허용하고(<details> 의도 통과),
// 사용자 문서에 스크립트가 섞일 수 있다(→ preview-strategy.md#sanitize는-필수다).

const TASK_MARKER = /^\[( |x|X)\] /;

// GFM 체크박스(작업 목록) — markdown-it 본체에 없는 문법이라 코어 룰로 직접 구현한다.
// 리스트 아이템 첫 텍스트의 "[ ] "/"[x] " 마커를 표시 전용 체크박스로 바꾼다.
// 프리뷰는 표시 전용이고 진실은 소스이므로 체크박스는 disabled다(→ preview-strategy.md#파이프라인-웹뷰-내).
function taskListPlugin(md: MarkdownIt): void {
  md.core.ruler.after("inline", "norii-task-list", (state) => {
    const tokens = state.tokens;
    for (let i = 2; i < tokens.length; i += 1) {
      const inline = tokens[i];
      const paragraphOpen = tokens[i - 1];
      const listItemOpen = tokens[i - 2];
      if (
        inline?.type !== "inline" ||
        paragraphOpen?.type !== "paragraph_open" ||
        listItemOpen?.type !== "list_item_open"
      ) {
        continue;
      }
      const first = inline.children?.[0];
      if (!first || first.type !== "text") {
        continue;
      }
      const match = TASK_MARKER.exec(first.content);
      if (!match) {
        continue;
      }
      const checked = match[1] !== " ";
      first.content = first.content.slice(match[0].length);
      const checkbox = new state.Token("html_inline", "", 0);
      checkbox.content = `<input type="checkbox" disabled${checked ? " checked" : ""}> `;
      inline.children?.unshift(checkbox);
      listItemOpen.attrJoin("class", "task-list-item");
    }
  });
}

// html: 원시 HTML 통과(<details> 등) — 위험분은 아래 sanitize가 제거한다.
// linkify: GFM 오토링크. 테이블·취소선은 markdown-it 기본 프리셋에 포함.
// @vscode/markdown-it-katex는 CJS라 상황에 따라 기본 내보내기가 한 겹 더 감싸여 온다
// ({ default: fn }). 번들러·런타임마다 갈리므로 양쪽을 다 받는다.
type MarkdownItPlugin = (md: MarkdownIt) => void;
const katex: MarkdownItPlugin =
  (katexPlugin as unknown as { default?: MarkdownItPlugin }).default ??
  (katexPlugin as unknown as MarkdownItPlugin);

// 수식은 @vscode/markdown-it-katex(Microsoft 유지보수 포크)를 쓴다 — 원본 markdown-it-katex는
// 사실상 대체됐다(→ preview-strategy.md#수식-katex). 각주는 markdown-it-footnote.
const md = new MarkdownIt({ html: true, linkify: true })
  .use(taskListPlugin)
  .use(calloutPlugin)
  .use(headingAnchorPlugin)
  .use(footnotePlugin)
  // maxSize: 사용자가 지정하는 크기(\rule 등)의 상한(em). 기본값이 Infinity라 수식 하나로
  // 문서 높이를 수백만 px로 만들 수 있다 — 문서는 못 믿는 입력이다. 100em(≈화면 두 장)은
  // 정상 수식이 닿지 않는 넉넉한 상한이다(→ preview-strategy.md#수식-katex).
  .use(katex, { maxSize: 100 })
  .use(sourceLinePlugin)
  .use(mermaidFencePlugin);

// 프로토콜이 없는 "맨 도메인"은 링크로 만들지 않는다(fuzzyLink 끔).
// 기본값으로 두면 확장자를 TLD로 착각해 **파일명이 링크가 된다** — .md는 몰도바, .sh는
// 세인트헬레나의 실제 도메인이라 README.md·deploy.sh가 http://readme.md로 나간다. 마크다운
// 문서에 파일명은 늘 나오므로 오탐이 상시적이고, 누르면 OS 브라우저가 엉뚱한 사이트를 연다.
// 잃는 것은 `www.`로 시작하는 표기의 자동 링크뿐이다 — 프로토콜을 붙이면 그대로 링크가 된다.
md.linkify.set({ fuzzyLink: false });

// <style>은 기본 허용이지만 문서 CSS가 프리뷰 밖 앱 UI를 위장·은폐할 수 있어 차단한다
// (→ preview-strategy.md#sanitize는-필수다의 DOMPurify 정책).
//
// KaTeX는 눈으로 보는 HTML과 스크린리더가 읽는 MathML을 함께 낸다. DOMPurify의 MathML
// 허용목록에는 <semantics>·<annotation>이 없어, 그대로 두면 이 둘만 벗겨지고 그 안의 TeX
// 원문이 맨 텍스트로 <math> 안에 남는다 — 수식이 "x^2"처럼 두 번 읽히는 셈이다. 둘을
// 허용해 KaTeX의 출력 구조를 온전히 보존한다(내용은 텍스트뿐이라 실행 표면이 아니다).
const SANITIZE_CONFIG = {
  FORBID_TAGS: ["style"],
  ADD_TAGS: ["semantics", "annotation"],
  ADD_ATTR: ["encoding"],
};

/** 마크다운 소스를 sanitize된 HTML 문자열로 렌더한다. */
export function renderMarkdown(source: string): string {
  return DOMPurify.sanitize(md.render(source), SANITIZE_CONFIG);
}
