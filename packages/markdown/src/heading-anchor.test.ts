import { describe, expect, it } from "vitest";

import { slugify } from "./heading-anchor";
import { renderMarkdown } from "./render";

// 집행: preview-strategy.md#헤딩-앵커 — 헤딩에 GitHub 호환 slug id를 붙인다.
//
// 왜: markdown-it은 헤딩에 id를 붙이지 않는다. 그래서 목차 링크(`[개요](#개요)`)가 가리킬
//     대상이 없어 아무 일도 일어나지 않는다 — 링크는 보이는데 죽어 있다. 사용자가 GitHub에서
//     쓰던 목차가 norii에서도 그대로 동작해야 한다.
// 보장: 헤딩이 slug id를 갖고, 규칙이 GitHub과 같으며(소문자화·공백은 하이픈·한글 유지),
//       같은 제목이 두 번 나와도 id가 겹치지 않는다.
// 경계: 클릭했을 때의 스크롤은 소비 측(apps/desktop)의 몫이라 여기서 다루지 않는다.
describe("slugify — GitHub 호환 규칙", () => {
  it.each([
    ["개요", "개요"],
    ["API 설계", "api-설계"],
    ["Step 1: 준비", "step-1-준비"],
    ["  앞뒤 공백  ", "앞뒤-공백"],
    ["점·가운뎃점, 쉼표!", "점가운뎃점-쉼표"],
    ["여러   칸", "여러-칸"],
    ["snake_case-유지", "snake_case-유지"],
  ])("%s → #%s", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it("남는 글자가 없으면 빈 문자열이다 — 소비 측이 대체 id를 정한다", () => {
    expect(slugify("!!!")).toBe("");
  });
});

describe("헤딩 앵커 — 렌더", () => {
  it("헤딩에 id가 붙는다", () => {
    const html = renderMarkdown("# 개요\n\n## API 설계");
    expect(html).toContain('id="개요"');
    expect(html).toContain('id="api-설계"');
  });

  it("같은 제목이 두 번 나오면 뒤엣것에 번호를 붙인다 — id는 문서에서 유일해야 한다", () => {
    const html = renderMarkdown("# 준비\n\n# 준비\n\n# 준비");
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const ids = [...parsed.querySelectorAll("h1")].map((h) => h.id);
    expect(ids).toEqual(["준비", "준비-1", "준비-2"]);
  });

  it("문서마다 번호가 새로 시작한다 — 렌더는 서로 독립이다", () => {
    renderMarkdown("# 준비\n\n# 준비");
    const html = renderMarkdown("# 준비");
    expect(html).toContain('id="준비"');
    expect(html).not.toContain('id="준비-1"');
  });

  it("slug가 비면 자리 번호로 대체한다 — id 없는 헤딩을 남기지 않는다", () => {
    const html = renderMarkdown("# !!!");
    expect(html).toMatch(/<h1[^>]*id="[^"]+"/);
  });

  it("id가 sanitize를 통과한다 — 통과하지 못하면 앵커가 가리킬 대상이 사라진다", () => {
    const parsed = new DOMParser().parseFromString(renderMarkdown("## 개요"), "text/html");
    expect(parsed.querySelector("#개요")).not.toBeNull();
  });

  it("스크롤 동기화 꼬리표와 함께 붙는다 — 둘은 서로를 지우지 않는다", () => {
    const html = renderMarkdown("# 개요");
    expect(html).toContain('id="개요"');
    expect(html).toContain('data-source-line="1"');
  });
});
