import { describe, expect, it } from "vitest";

import { AA_TEXT, contrastOnGlass, contrastOnSolid } from "@shared/lib";

import { resolveSemanticColors } from "./resolve-tokens";

// 왜: 크롬은 유리라 뒤에 무엇이 오는지(사용자의 바탕화면) 통제할 수 없다. "읽히는지 눈으로 본다"는
//     합격선이 없어 리뷰어가 바뀌면 결론이 바뀐다. 대비는 토큰 값만으로 계산되는 순수 함수이므로
//     게이트로 만들 수 있다(→ .claude/docs/design/design-system.md#대비-게이트).
// 보장: 팔레트가 접근성 기준을 어기면 빌드가 막힌다 — 종이 위 글자는 AA(4.5:1),
//     유리 위 글자는 "가장 밝은 바탕화면"과 "가장 어두운 바탕화면" 양쪽에서 AA.
// 경계: 색 계산 자체의 정확성은 color-contrast.test.ts가 검증한다. 여기서는 토큰 조합만 본다.
//     유리가 실제로 보이는지는 OS 합성기 영역이라 수동 검증한다(→ design/window-chrome.md#검증).

const THEMES = ["light", "dark"] as const;

describe.each(THEMES)("%s 테마 — 종이 위 글자", (theme) => {
  const colors = resolveSemanticColors(theme);

  it.each([
    ["본문", "text"],
    ["흐린 글자", "textMuted"],
    ["액센트", "accent"],
  ] as const)("%s는 종이 위에서 AA를 만족한다", (_label, key) => {
    const ratio = contrastOnSolid(colors[key], colors.bgPaper);
    expect(ratio).toBeGreaterThanOrEqual(AA_TEXT);
  });
});

describe.each(THEMES)("%s 테마 — 유리(크롬) 위 글자", (theme) => {
  const colors = resolveSemanticColors(theme);

  // 크롬 틴트의 알파는 이 검사가 하한을 정한다. 알파를 낮춰 유리를 더 투명하게 만들면
  // 밝은 바탕화면 쪽에서 먼저 무너진다.
  it("본문색은 어떤 바탕화면 위에서도 AA를 만족한다", () => {
    const { onWhite, onBlack } = contrastOnGlass(colors.text, colors.bgChrome);
    expect(onWhite).toBeGreaterThanOrEqual(AA_TEXT);
    expect(onBlack).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("흐린 글자는 유리 위에서 기준을 통과하지 못한다 — 그래서 크롬에 쓰지 않는다", () => {
    expect(worstOnGlass(colors.textMuted, colors.bgChrome)).toBeLessThan(AA_TEXT);
  });
});

// 유리 위 글자는 양극단을 **모두** 통과해야 하므로, "통과하지 못한다" = 한쪽이라도 미달이다.
// 무너지는 쪽은 테마마다 다르다 — 밝은 틴트(라이트)는 어두운 바탕화면에서, 어두운 틴트(다크)는
// 밝은 바탕화면에서 먼저 깨진다. 그래서 최솟값으로 판정한다.
function worstOnGlass(text: string, tint: string): number {
  const { onWhite, onBlack } = contrastOnGlass(text, tint);
  return Math.min(onWhite, onBlack);
}

describe("크롬 위 액센트 금지 (→ decisions/0004)", () => {
  // 다크 테마만 보면 라임 액센트는 유리 위에서도 통과한다. 금지의 근거는 라이트 테마다 —
  // 흰 틴트 위 올리브 액센트가 어두운 바탕화면에서 무너진다.
  // 컴포넌트 코드는 한 갈래이므로 규칙도 하나여야 한다: 한 테마에서 못 쓰면 두 테마 모두에서 금지다.
  it("액센트는 적어도 한 테마의 유리 위에서 기준을 통과하지 못한다", () => {
    const failing = THEMES.filter((theme) => {
      const colors = resolveSemanticColors(theme);
      return worstOnGlass(colors.accent, colors.bgChrome) < AA_TEXT;
    });
    expect(failing.length).toBeGreaterThan(0);
  });
});
