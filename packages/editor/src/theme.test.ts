import { describe, expect, it } from "vitest";

import { editorThemeSpec, markdownHighlightSpec, type EditorColors } from "./theme";

// 왜: CM6는 테마를 주지 않으면 자기 기본값으로 그린다 — 활성 줄은 옅은 파랑(#cceeff),
//     검색 패널은 회색(#f5f5f5). 둘 다 앱 팔레트 밖 색이라 화면에 이물질로 남는다
//     (실앱에서 관찰해 확인한 문제다). 이 테스트는 "덮었는가"를 고정한다.
// 보장: 우리 테마가 그 자리들을 **주입받은 색으로** 채운다 — 하드코딩된 색이 새어 나오지 않는다.
// 경계: 실제 픽셀은 브라우저가 그린다. 여기서는 테마 스펙(CM6가 생성하는 규칙)만 검사한다.
//     색이 접근성 기준을 만족하는지는 앱의 대비 게이트가 본다(design-tokens.test.ts).

const COLORS: EditorColors = {
  paper: "var(--paper)",
  text: "var(--text)",
  muted: "var(--muted)",
  mark: "var(--mark)",
  accent: "var(--accent)",
  hover: "var(--hover)",
  selection: "var(--selection)",
  match: "var(--match)",
  border: "var(--border)",
};

// 테마 스펙(순수 객체)을 검사한다 — CM6 확장으로 감싸고 나면 색이 StyleModule 안으로 숨어
// 밖에서 볼 수 없다. 그래서 스펙 단계에서 고정한다.
// 하이라이트 스펙은 lezer Tag(순환 참조)를 품고 있어 통째로 직렬화할 수 없다 — 색만 뽑는다.
function themeRules(): string {
  const highlightColors = markdownHighlightSpec(COLORS)
    .map((style) => [style.color, style.fontWeight, style.fontStyle, style.textDecoration])
    .flat()
    .filter(Boolean)
    .join(" ");
  return `${JSON.stringify(editorThemeSpec(COLORS))} ${highlightColors}`;
}

describe("noriiTheme", () => {
  it("주입받은 색만 쓴다 — CM6 기본 하드코딩 색이 남지 않는다", () => {
    const rules = themeRules();
    // CM6 기본 테마의 대표적인 하드코딩 값들.
    expect(rules).not.toContain("#cceeff"); // 활성 줄 (파란 띠)
    expect(rules).not.toContain("#f5f5f5"); // 검색 패널 배경
    expect(rules).not.toContain("#d9d9d9"); // 패널 경계
  });

  it("활성 줄을 앱의 상태 배경색으로 덮는다", () => {
    expect(themeRules()).toContain("var(--hover)");
  });

  it("커서는 액센트다 — 살아 있는 것의 표시", () => {
    expect(themeRules()).toContain("var(--accent)");
  });

  it("편집면 배경을 명시적으로 칠한다 — 유리를 켜도 본문이 뚫리지 않게", () => {
    expect(themeRules()).toContain("var(--paper)");
  });

  it("구문 마크에 mark 색을 쓴다 — 액센트는 글자에 쓰지 않으므로", () => {
    expect(themeRules()).toContain("var(--mark)");
  });

  // 왜: 선택 영역과 활성 줄이 같은 색이면, 커서가 있는 줄에서 글자를 끌 때 **선택이 사라진다** —
  //     두 배경이 겹쳐 구분이 없어지기 때문이다. 브라우저 기본 선택색(파랑)을 덮은 대가다.
  // 보장: 겹쳐 놓이는 배경들이 서로 다른 토큰을 쓴다.
  // 경계: "충분히 잘 보이는가"는 값의 문제이고 팔레트(panda.config.ts)가 소유한다.
  //     여기서는 **자리마다 다른 토큰을 쓰는지**만 고정한다.
  it("선택 영역은 활성 줄과 다른 색이다 — 겹쳐도 선택이 보이게", () => {
    const spec = editorThemeSpec(COLORS);
    const selection =
      spec[
        "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection"
      ];
    const activeLine = spec[".cm-activeLine"];

    expect(selection?.backgroundColor).toBe("var(--selection)");
    expect(activeLine?.backgroundColor).toBe("var(--hover)");
    expect(selection?.backgroundColor).not.toBe(activeLine?.backgroundColor);
  });

  it("검색 결과는 선택 영역과 다른 색이다 — 무엇이 찾은 것이고 무엇이 고른 것인지 갈리게", () => {
    const spec = editorThemeSpec(COLORS);

    expect(spec[".cm-searchMatch"]?.backgroundColor).toBe("var(--match)");
    // 여러 결과 중 **지금 보고 있는 하나**는 선택과 같은 무게로 도드라진다.
    expect(spec[".cm-searchMatch.cm-searchMatch-selected"]?.backgroundColor).toBe(
      "var(--selection)",
    );
  });
});
