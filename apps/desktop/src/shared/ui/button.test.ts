import { describe, expect, it } from "vitest";

import { BUTTON_STYLES } from "./button";

// 왜: 버튼 정의가 파일마다 흩어져 있으면 한쪽만 고쳐져 모습이 갈린다. 한 곳에서 나오게 하고,
//     디자인 규칙이 정한 것(액센트는 채운 면·비활성은 액센트 회수·포커스 링은 안쪽)을 여기서 막는다.
// 경계: 실제 색이 대비 기준을 넘는지는 design-tokens.test.ts가, 포커스 링의 값은
//     layer-styles.test.ts가 본다. 여기서는 어느 토큰을 고르는지만 본다.
//     렌더 결과는 각 화면의 browser 테스트가 본다.

const { base, variants } = BUTTON_STYLES;

describe("버튼 변형", () => {
  it("액센트 변형은 채운 면이고, 그 위 글자와 테두리는 accent.fg다", () => {
    expect(variants.variant.accent).toMatchObject({
      background: "accent",
      color: "accent.fg",
      borderColor: "accent.fg",
    });
  });

  it("액센트 변형의 hover·pressed는 액센트를 어둡게 한 값이다", () => {
    expect(variants.variant.accent["_hover"].background).toBe("accent.hover");
    expect(variants.variant.accent["_active"].background).toBe("accent.pressed");
  });

  // 액센트는 채운 면에만 쓴다 — 나머지 변형이 액센트를 집으면 그 규칙이 깨진다.
  it("액센트가 아닌 변형은 액센트 토큰을 쓰지 않는다", () => {
    for (const name of ["outline", "ghost"] as const) {
      expect(JSON.stringify(variants.variant[name])).not.toContain("accent");
    }
  });
});

describe("모든 변형이 공유하는 것", () => {
  it("포커스 링은 바깥에 그린다", () => {
    expect(base.layerStyle).toBe("focusOutside");
  });

  it("비활성은 액센트를 회수하고 무채색으로 둔다", () => {
    expect(base["_disabled"]).toMatchObject({
      background: "bg.hover",
      color: "text.muted",
      borderColor: "border",
    });
    expect(JSON.stringify(base["_disabled"])).not.toContain("accent");
  });
});
