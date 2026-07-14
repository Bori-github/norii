import { describe, expect, it } from "vitest";

import { CALLOUT_CLASS, CALLOUT_TYPES } from "./callout";
import { renderMarkdown } from "./render";

// 집행: preview-strategy.md#콜아웃-gfm-alerts — 인용문의 첫 줄이 `[!NOTE]` 꼴이면 강조 상자다.
//
// 왜: 문법이 이미 마크다운이라(`>`는 인용문, `[!NOTE]`는 그 안의 텍스트) norii가 렌더하지
//     않아도 다른 에디터에서 평범한 인용문으로 읽힌다. 호환을 깨지 않고 강조를 얻는 유일한 길이다.
// 보장: GitHub 표준 5종만 상자가 되고, 그 밖의 타입은 **평범한 인용문으로 남으며**(임의 확장
//       금지), 마커 텍스트는 본문에서 사라지고, 클래스가 sanitize를 통과한다.
// 경계: 아이콘·색은 CSS의 몫이라 여기서 다루지 않는다(마크업을 늘리지 않는 것이 정책이다).
describe("콜아웃 (GFM alerts)", () => {
  it.each(CALLOUT_TYPES)("[!%s]를 콜아웃 상자로 만든다", (type) => {
    const html = renderMarkdown(`> [!${type}]\n> 내용이다.`);
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const box = parsed.querySelector("blockquote");
    expect(box?.classList.contains(CALLOUT_CLASS)).toBe(true);
    expect(box?.classList.contains(`${CALLOUT_CLASS}-${type.toLowerCase()}`)).toBe(true);
  });

  it("마커는 본문에서 사라진다 — 화면에 [!NOTE]가 보이면 안 된다", () => {
    const html = renderMarkdown("> [!NOTE]\n> 참고할 내용.");
    expect(html).not.toContain("[!NOTE]");
    expect(html).toContain("참고할 내용.");
  });

  it("소문자·혼합 표기도 받는다 — GitHub과 같다", () => {
    const html = renderMarkdown("> [!warning]\n> 조심.");
    const parsed = new DOMParser().parseFromString(html, "text/html");
    expect(parsed.querySelector("blockquote")?.classList.contains(`${CALLOUT_CLASS}-warning`)).toBe(
      true,
    );
  });

  it("5종 밖의 타입은 평범한 인용문으로 남는다 — 임의로 상자를 씌우지 않는다", () => {
    const html = renderMarkdown("> [!FOO]\n> 내용.");
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const quote = parsed.querySelector("blockquote");
    expect(quote).not.toBeNull();
    expect(quote?.className).toBe("");
    // 마커도 그대로 남는다 — 우리가 해석하지 않는 텍스트이므로 건드리지 않는다.
    expect(quote?.textContent).toContain("[!FOO]");
  });

  it("평범한 인용문은 그대로다", () => {
    const html = renderMarkdown("> 그냥 인용문.");
    const parsed = new DOMParser().parseFromString(html, "text/html");
    expect(parsed.querySelector("blockquote")?.className).toBe("");
  });

  it("마커가 첫 줄이 아니면 콜아웃이 아니다 — 본문 속 [!NOTE]는 텍스트다", () => {
    const html = renderMarkdown("> 앞말\n> [!NOTE]\n> 뒷말");
    const parsed = new DOMParser().parseFromString(html, "text/html");
    expect(parsed.querySelector("blockquote")?.className).toBe("");
  });

  it("여러 문단·목록을 담을 수 있다 — 상자는 인용문이므로 안에 마크다운이 산다", () => {
    const html = renderMarkdown("> [!TIP]\n> 첫 문단.\n>\n> - 목록\n> - 둘");
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const box = parsed.querySelector(`.${CALLOUT_CLASS}`);
    expect(box?.querySelectorAll("li")).toHaveLength(2);
  });

  it("클래스가 sanitize를 통과한다 — 통과하지 못하면 상자가 그려지지 않는다", () => {
    expect(renderMarkdown("> [!NOTE]\n> x")).toContain(`${CALLOUT_CLASS}-note`);
  });

  it("스크롤 동기화 꼬리표를 유지한다", () => {
    const html = renderMarkdown("# 제목\n\n> [!NOTE]\n> 내용.");
    const parsed = new DOMParser().parseFromString(html, "text/html");
    expect(parsed.querySelector("blockquote")?.getAttribute("data-source-line")).toBe("3");
  });
});
