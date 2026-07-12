import { describe, expect, it } from "vitest";

import { renderMarkdown } from "./render";

// 집행: preview-strategy.md#파이프라인-웹뷰-내 — 소스 텍스트 → markdown-it(GFM) → DOMPurify → HTML.
//
// 왜: 프리뷰는 사용자가 쓴 마크다운을 그대로 렌더한다. 파싱이 틀리면 화면이 깨지고,
//     sanitize가 빠지면 문서에 섞인 스크립트가 앱 안에서 실행된다(XSS).
// 보장: GFM 문법(테이블·체크박스·취소선)이 렌더되고, 위험한 HTML은 삽입 전에 제거되며,
//       의도적으로 통과시키는 원시 HTML(<details>)은 살아남는다.
// 경계: 소스 라인 매핑(단위 2)·디바운스·DOM 삽입(소비 측 책임)은 다루지 않는다.
//       KaTeX·Mermaid·각주는 이후 마일스톤이라 다루지 않는다(→ preview-strategy.md#수식다이어그램-지원-채택).
describe("renderMarkdown — 마크다운 파싱 (GFM)", () => {
  it("헤딩과 문단을 렌더한다", () => {
    const html = renderMarkdown("# 제목\n\n본문");
    expect(html).toContain("<h1>제목</h1>");
    expect(html).toContain("<p>본문</p>");
  });

  it("GFM 테이블을 렌더한다", () => {
    const html = renderMarkdown("| 이름 |\n| --- |\n| 값 |");
    expect(html).toContain("<table>");
    expect(html).toContain("<th>이름</th>");
    expect(html).toContain("<td>값</td>");
  });

  it("취소선(~~)을 렌더한다", () => {
    const html = renderMarkdown("~~지움~~");
    expect(html).toContain("<s>지움</s>");
  });

  it("체크박스(작업 목록)를 렌더한다 — 체크 상태를 보존한다", () => {
    const html = renderMarkdown("- [x] 완료\n- [ ] 미완");
    const checkboxes = html.match(/<input[^>]*type="checkbox"[^>]*>/g) ?? [];
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[0]).toContain("checked");
    expect(checkboxes[1]).not.toContain("checked");
    // 마커 텍스트("[x] ")는 본문에서 제거되고 라벨만 남는다.
    expect(html).toContain("완료");
    expect(html).not.toContain("[x]");
  });

  it("체크박스는 편집 불가다 — 프리뷰는 표시 전용이고 진실은 소스다", () => {
    const html = renderMarkdown("- [ ] 할 일");
    expect(html).toMatch(/<input[^>]*disabled[^>]*>/);
  });
});

describe("renderMarkdown — sanitize (필수)", () => {
  it("<script>를 제거한다", () => {
    const html = renderMarkdown('본문\n\n<script>alert("xss")</script>');
    expect(html).not.toContain("<script");
    expect(html).toContain("본문");
  });

  it("인라인 이벤트 핸들러(onerror)를 제거한다", () => {
    const html = renderMarkdown('<img src="x" onerror="alert(1)">');
    expect(html).not.toContain("onerror");
  });

  it("javascript: 링크를 무해화한다 — 실행 가능한 href가 남지 않는다", () => {
    // 두 층이 겹으로 막는다(→ security.md#3층-방어): 마크다운 문법 링크는 markdown-it이
    // 거부해 링크가 아닌 일반 텍스트로 남고, 원시 HTML 앵커는 DOMPurify가 href를 제거한다.
    const viaMarkdown = renderMarkdown("[클릭](javascript:alert(1))");
    expect(viaMarkdown).not.toMatch(/href\s*=\s*"[^"]*javascript:/i);
    expect(viaMarkdown).not.toContain("<a");
    const viaRawHtml = renderMarkdown('<a href="javascript:alert(1)">클릭</a>');
    expect(viaRawHtml).not.toMatch(/href\s*=\s*"[^"]*javascript:/i);
    expect(viaRawHtml).toContain("클릭");
  });

  it("<details>/<summary>는 통과시킨다 — 텍스트 안에 사는 정식 구조다(→ non-goals.md)", () => {
    const html = renderMarkdown("<details><summary>접기</summary>\n\n내용\n\n</details>");
    expect(html).toContain("<details>");
    expect(html).toContain("<summary>접기</summary>");
    expect(html).toContain("내용");
  });
});
