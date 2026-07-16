import { describe, expect, it } from "vitest";

import { decodeMermaidSource, MERMAID_CODE_ATTR, MERMAID_PLACEHOLDER_CLASS } from "./mermaid";
import { renderMarkdown } from "./render";

// 집행: preview-strategy.md#다이어그램-mermaid — mermaid 펜스는 markdown-it 플러그인이
// 아니라 **플레이스홀더**로 나가고, 클라이언트(apps/desktop)가 SVG로 렌더한다.
//
// 왜: 파서 단계에서 SVG를 만들면 무거운 mermaid가 packages/markdown에 상시 묶이고,
//     sanitize가 엔진 출력 SVG를 깎는다. 사용자 원문만 sanitize를 통과시키고 SVG는
//     정화 뒤 자리에 그린다 — 이 파일은 그 경계의 파서 쪽 절반을 고정한다.
// 보장: mermaid 펜스가 빈 플레이스홀더 div로 나오고, 원문이 sanitize를 통과해 살아남으며,
//       다른 언어의 펜스는 건드리지 않고, 스크롤 동기화 꼬리표가 유지된다.
// 경계: 실제 SVG 렌더·lazy-load·캐시는 소비 측(apps/desktop의 use-mermaid) 책임이라
//       여기서 다루지 않는다.
/** 소비 측이 하는 일 — 플레이스홀더를 찾아 원문을 되읽는다. sanitize 뒤 결과에서 읽는다. */
function sourceOf(html: string): string | undefined {
  const placeholder = new DOMParser()
    .parseFromString(html, "text/html")
    .querySelector(`.${MERMAID_PLACEHOLDER_CLASS}`);
  const encoded = placeholder?.getAttribute(MERMAID_CODE_ATTR);
  return encoded === null || encoded === undefined ? undefined : decodeMermaidSource(encoded);
}

describe("mermaid 펜스 — 플레이스홀더", () => {
  it("mermaid 펜스를 빈 플레이스홀더 div로 내보낸다 — 코드 블록으로 그리지 않는다", () => {
    const html = renderMarkdown("```mermaid\ngraph TD;\nA-->B;\n```");
    expect(html).toContain(`class="${MERMAID_PLACEHOLDER_CLASS}"`);
    expect(html).not.toContain("<pre>");
    expect(html).not.toContain("<code");
  });

  it("펜스 원문을 왕복시킨다 — 디코더가 원문을 그대로 되돌린다", () => {
    const html = renderMarkdown("```mermaid\ngraph TD;\nA-->B;\n```");
    expect(sourceOf(html)).toBe("graph TD;\nA-->B;\n");
  });

  it("화살표(-->)가 든 원문이 sanitize를 살아남는다 — DOMPurify가 통째로 버리던 지점", () => {
    // 회귀 방어: 원문을 날것으로 속성에 실으면 DOMPurify의 SAFE_FOR_XML 방어가 `-->`를
    // XML 주석 닫기로 보고 속성을 버린다. 그런데 `-->`는 플로차트의 기본 화살표라
    // 다이어그램이 조용히 사라진다. 퍼센트 인코딩이 그 방어에 걸리지 않게 하는 근거다.
    const html = renderMarkdown("```mermaid\nflowchart LR\n  A-->B-->C\n```");
    expect(html).toContain(MERMAID_CODE_ATTR);
    expect(sourceOf(html)).toContain("A-->B-->C");
  });

  it("원문의 따옴표·꺾쇠가 마크업으로 새 나가지 않는다 — 주입 경계", () => {
    const html = renderMarkdown('```mermaid\ngraph TD;\nA["<b>x</b>"]-->B;\n```');
    expect(sourceOf(html)).toContain('A["<b>x</b>"]');
    // 원문은 속성값 안에 갇혀 있어야 한다 — 태그로 살아나면 문서가 마크업을 주입한 것이다.
    expect(new DOMParser().parseFromString(html, "text/html").querySelector("b")).toBeNull();
  });

  it("스크롤 동기화 꼬리표를 유지한다 — 다이어그램도 소스 라인에 정렬돼야 한다", () => {
    const html = renderMarkdown("# 제목\n\n```mermaid\ngraph TD;\nA-->B;\n```");
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const placeholder = parsed.querySelector(`.${MERMAID_PLACEHOLDER_CLASS}`);
    // 펜스는 3번째 줄에서 시작한다(1-기반).
    expect(placeholder?.getAttribute("data-source-line")).toBe("3");
  });

  it("다른 언어의 펜스는 그대로 코드 블록이다 — 규칙이 mermaid에만 걸린다", () => {
    const html = renderMarkdown("```ts\nconst a = 1;\n```");
    expect(html).toContain("<pre>");
    expect(html).not.toContain(MERMAID_PLACEHOLDER_CLASS);
  });

  it("정보 문자열의 대소문자·뒤 인자를 허용한다 — ```Mermaid, ```mermaid 도 인식", () => {
    expect(renderMarkdown("```Mermaid\ngraph TD;\n```")).toContain(MERMAID_PLACEHOLDER_CLASS);
    expect(renderMarkdown("```mermaid extra\ngraph TD;\n```")).toContain(MERMAID_PLACEHOLDER_CLASS);
  });

  it("mermaid로 시작하는 다른 언어는 아니다 — mermaidjs는 코드 블록이다", () => {
    expect(renderMarkdown("```mermaidjs\ngraph TD;\n```")).not.toContain(MERMAID_PLACEHOLDER_CLASS);
  });
});
