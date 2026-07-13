import { describe, expect, it } from "vitest";

import {
  composite,
  contrastOnGlass,
  contrastOnSolid,
  contrastRatio,
  parseColor,
  relativeLuminance,
} from "./color-contrast";

// 왜: 디자인 토큰의 접근성은 "눈으로 본다"로는 합격선이 없어 리뷰어마다 결론이 갈린다.
//     대비를 계산으로 판정해야 게이트가 될 수 있다(→ .claude/docs/design/design-system.md#대비-게이트).
//     이 파일은 그 계산 자체가 옳은지를 먼저 못 박는다 — 계산이 틀리면 게이트가 통과해도 의미가 없다.
// 보장: WCAG 상대 휘도·대비비 공식과 알파 합성이 표준값과 일치한다.
// 경계: "어떤 토큰 조합이 허용되는가"는 여기서 판단하지 않는다 — 토큰 게이트(design-tokens.test.ts)가 한다.
describe("색 파싱", () => {
  it("hex를 채널로 읽는다", () => {
    expect(parseColor("#cafb41")).toEqual({ rgb: [202, 251, 65], alpha: 1 });
  });

  it("3자리 hex를 6자리로 확장한다", () => {
    expect(parseColor("#fff")).toEqual({ rgb: [255, 255, 255], alpha: 1 });
  });

  it("rgba의 알파를 읽는다 — 유리 틴트가 이 형식이다", () => {
    expect(parseColor("rgba(17, 17, 19, 0.67)")).toEqual({ rgb: [17, 17, 19], alpha: 0.67 });
  });

  it("해석할 수 없는 색은 조용히 넘기지 않고 던진다", () => {
    expect(() => parseColor("hotpink")).toThrow();
  });
});

describe("WCAG 대비 계산", () => {
  it("흰 배경 위 검정은 최대 대비 21:1이다", () => {
    expect(contrastRatio([255, 255, 255], [0, 0, 0])).toBeCloseTo(21, 1);
  });

  it("같은 색끼리는 1:1이다", () => {
    expect(contrastRatio([120, 120, 120], [120, 120, 120])).toBeCloseTo(1, 5);
  });

  it("순서를 바꿔도 결과가 같다 — 비는 방향이 없다", () => {
    const a = contrastRatio([202, 251, 65], [17, 17, 19]);
    const b = contrastRatio([17, 17, 19], [202, 251, 65]);
    expect(a).toBeCloseTo(b, 10);
  });

  it("휘도는 감마 보정된 sRGB를 따른다 (흰=1, 검정=0)", () => {
    expect(relativeLuminance([255, 255, 255])).toBeCloseTo(1, 5);
    expect(relativeLuminance([0, 0, 0])).toBeCloseTo(0, 5);
  });
});

describe("알파 합성", () => {
  it("알파 1은 배경을 완전히 덮는다", () => {
    expect(composite([202, 251, 65], 1, [255, 255, 255])).toEqual([202, 251, 65]);
  });

  it("알파 0은 배경만 남긴다", () => {
    expect(composite([202, 251, 65], 0, [255, 255, 255])).toEqual([255, 255, 255]);
  });

  it("반투명 검정을 흰 위에 얹으면 중간 회색이 된다", () => {
    expect(composite([0, 0, 0], 0.5, [255, 255, 255])).toEqual([128, 128, 128]);
  });
});

describe("유리 위 대비 — 바탕화면 양극단", () => {
  // 유리 뒤에 무엇이 오는지는 사용자의 바탕화면이 정한다. 우리가 아는 것은 틴트의 알파뿐이고,
  // 합성 결과는 [순흑 위 · 순백 위] 사이에 갇힌다. 그래서 두 극단만 검사하면 전부 커버된다.
  it("가장 밝은 바탕화면과 가장 어두운 바탕화면 양쪽의 대비를 낸다", () => {
    const { onWhite, onBlack } = contrastOnGlass("#dcdbdd", "rgba(17, 17, 19, 0.67)");
    expect(onWhite).toBeGreaterThan(1);
    expect(onBlack).toBeGreaterThan(onWhite); // 어두운 바탕 위에서 밝은 글자가 더 잘 보인다
  });

  it("알파가 낮을수록 바탕화면이 더 비쳐 최악(순백 위) 대비가 나빠진다", () => {
    const thick = contrastOnGlass("#dcdbdd", "rgba(17, 17, 19, 0.9)");
    const thin = contrastOnGlass("#dcdbdd", "rgba(17, 17, 19, 0.4)");
    expect(thin.onWhite).toBeLessThan(thick.onWhite);
  });
});

describe("불투명 배경 위 대비", () => {
  it("종이 위 본문은 바탕화면과 무관하게 결정된다", () => {
    expect(contrastOnSolid("#111113", "#ffffff")).toBeCloseTo(18.86, 1);
  });

  it("반투명 글자는 배경에 합성한 뒤 잰다", () => {
    const solid = contrastOnSolid("#000000", "#ffffff");
    const translucent = contrastOnSolid("rgba(0, 0, 0, 0.5)", "#ffffff");
    expect(translucent).toBeLessThan(solid);
  });
});
