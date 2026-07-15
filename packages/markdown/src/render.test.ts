import { describe, expect, it } from "vitest";

import { renderMarkdown } from "./render";

// 집행: preview-strategy.md#파이프라인-웹뷰-내 — 소스 텍스트 → markdown-it(GFM) → DOMPurify → HTML.
//
// 왜: 프리뷰는 사용자가 쓴 마크다운을 그대로 렌더한다. 파싱이 틀리면 화면이 깨지고,
//     sanitize가 빠지면 문서에 섞인 스크립트가 앱 안에서 실행된다(XSS).
// 보장: GFM 문법(테이블·체크박스·취소선)이 렌더되고, 위험한 HTML은 삽입 전에 제거되며,
//       의도적으로 통과시키는 원시 HTML(<details>)은 살아남는다.
// 경계: 소스 라인 매핑(단위 2)·디바운스·DOM 삽입(소비 측 책임)은 다루지 않는다.
//       KaTeX·각주는 extensions.test.ts, mermaid는 mermaid.test.ts, 콜아웃은 callout.test.ts,
//       헤딩 앵커는 heading-anchor.test.ts가 각각 다룬다.
describe("renderMarkdown — 마크다운 파싱 (GFM)", () => {
  it("헤딩과 문단을 렌더한다", () => {
    // 블록 태그에는 라인 매핑 속성(data-source-line, → line-map.test.ts)이 함께 달린다.
    const html = renderMarkdown("# 제목\n\n본문");
    expect(html).toMatch(/<h1[^>]*>제목<\/h1>/);
    expect(html).toMatch(/<p[^>]*>본문<\/p>/);
  });

  it("GFM 테이블을 렌더한다", () => {
    const html = renderMarkdown("| 이름 |\n| --- |\n| 값 |");
    expect(html).toMatch(/<table[^>]*>/);
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

  it("대문자 [X]도 체크 상태로 렌더한다 — 마커 경계 고정", () => {
    const html = renderMarkdown("- [X] 완료");
    expect(html).toMatch(/<input[^>]*checked[^>]*>/);
  });

  it("뒤 공백 없는 '- [x]'는 작업 목록이 아니다 — 일반 텍스트로 남는다", () => {
    const html = renderMarkdown("- [x]");
    expect(html).not.toContain("<input");
    expect(html).toContain("[x]");
  });

  it("작업 목록 아이템에 task-list-item 클래스가 달린다 — 프리뷰 스타일이 이 이름에 의존한다", () => {
    // 소비 측(preview-pane)의 Panda 선택자 "& li.task-list-item"과 짝이다. 이름을 바꾸면 함께 바꾼다.
    const html = renderMarkdown("- [ ] 할 일");
    expect(html).toMatch(/<li[^>]*class="[^"]*task-list-item/);
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

  it("file: 링크의 href를 제거한다 — 문서가 로컬 파일을 가리키지 못하게(→ security.md#4-외부-링크)", () => {
    // 외부 링크 방어는 두 층이다: sanitize가 걷어내는 스킴(file: 등)과, 통과했더라도
    // OS로 넘기지 않는 허용목록(features/open-link). 이 테스트는 앞 층을 고정한다.
    const html = renderMarkdown('<a href="file:///etc/passwd">로컬 파일</a>');
    expect(html).not.toContain("file:");
    expect(html).toContain("로컬 파일");
  });

  it("<style> 태그를 제거한다 — 문서 CSS가 앱 UI를 위장·은폐하지 못하게(→ preview-strategy.md DOMPurify 정책)", () => {
    const html = renderMarkdown("본문\n\n<style>body { display: none; }</style>");
    expect(html).not.toContain("<style");
    expect(html).not.toContain("display: none");
    expect(html).toContain("본문");
  });

  it("<details>/<summary>는 통과시킨다 — 텍스트 안에 사는 정식 구조다(→ non-goals.md)", () => {
    const html = renderMarkdown("<details><summary>접기</summary>\n\n내용\n\n</details>");
    expect(html).toContain("<details>");
    expect(html).toContain("<summary>접기</summary>");
    expect(html).toContain("내용");
  });
});

// 왜: 이 앱의 문서에는 파일명이 늘 나온다(README.md·deploy.sh·index.ts). linkify의 기본
//     동작(fuzzyLink)은 확장자를 TLD로 착각해 이것들을 http:// 링크로 만든다 — .md는 몰도바,
//     .sh는 세인트헬레나의 실제 도메인이다. 그러면 사용자가 파일명을 눌렀을 때 OS 브라우저가
//     엉뚱한(심지어 타이포스쿼팅된) 사이트로 나간다.
// 보장: 프로토콜이 붙은 URL과 이메일만 자동 링크가 되고, 맨 파일명·도메인은 글자로 남는다.
// 경계: 링크를 눌렀을 때의 처리(웹뷰 차단·OS 브라우저 위임)는 소비 측의 몫이라 여기서 다루지 않는다.
describe("자동 링크 (linkify)", () => {
  it("프로토콜이 붙은 URL은 링크가 된다", () => {
    expect(renderMarkdown("https://tauri.app 를 보라")).toContain('href="https://tauri.app"');
  });

  it("이메일은 링크가 된다", () => {
    expect(renderMarkdown("hi@example.com 로 연락")).toContain("mailto:");
  });

  it("파일명은 링크가 아니다 — 확장자를 도메인으로 착각하지 않는다", () => {
    for (const source of ["README.md 참고", "deploy.sh 실행", "문서는 file-lifecycle.md 다"]) {
      expect(renderMarkdown(source)).not.toContain("<a ");
    }
  });

  it("맨 도메인도 링크가 아니다 — 프로토콜이 있어야 링크다", () => {
    expect(renderMarkdown("example.com 방문")).not.toContain("<a ");
  });
});
