import DOMPurify from "dompurify";
import MarkdownIt from "markdown-it";

// 프리뷰 파이프라인 — 소스 텍스트 → markdown-it(GFM) → DOMPurify sanitize → HTML 문자열.
// DOM 삽입은 소비 측(apps/desktop)이 담당한다(→ .claude/docs/preview-strategy.md).
//
// sanitize는 옵션이 아니라 필수다: 마크다운은 원시 HTML을 허용하고(<details> 의도 통과),
// 사용자 문서에 스크립트가 섞일 수 있다(→ preview-strategy.md#sanitize는-필수다).

const TASK_MARKER = /^\[( |x|X)\] /;

// GFM 체크박스(작업 목록) — markdown-it 본체에 없는 문법이라 코어 룰로 직접 구현한다.
// 리스트 아이템 첫 텍스트의 "[ ] "/"[x] " 마커를 표시 전용 체크박스로 바꾼다.
// 프리뷰는 표시 전용이고 진실은 소스이므로 체크박스는 disabled다(→ preview-strategy.md#두-파서-원칙).
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
const md = new MarkdownIt({ html: true, linkify: true }).use(taskListPlugin);

/** 마크다운 소스를 sanitize된 HTML 문자열로 렌더한다. */
export function renderMarkdown(source: string): string {
  return DOMPurify.sanitize(md.render(source));
}
