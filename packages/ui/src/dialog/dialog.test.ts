import { describe, expect, it } from "vitest";

import { DIALOG_STYLES } from "./dialog";

// 왜: 다이얼로그 껍데기가 화면마다 따로 정의되면 한쪽만 고쳐져 뒷막·그림자·모서리가 갈린다.
// 경계: 안의 내용(머리말·본문·버튼)은 각 화면이 갖는다. 여기서는 껍데기가 정하는 것만 본다.

const { base, variants } = DIALOG_STYLES;

describe("다이얼로그 껍데기", () => {
  it("뒤를 덮는 막은 scrim이다 — 어느 크기든 같다", () => {
    expect(base["_backdrop"]).toEqual({ background: "bg.scrim" });
    for (const size of ["sm", "lg"] as const) {
      expect(JSON.stringify(variants.size[size])).not.toContain("scrim");
    }
  });

  it("불투명한 종이 위에 그린다 — 투명 창에서 흐림이 걸리지 않는다", () => {
    expect(base).toMatchObject({ background: "bg.paper", boxShadow: "lg" });
  });

  it("모션을 줄이는 설정에서는 진입 모션을 끈다", () => {
    expect(base.animation).toBe("dialogIn 0.16s ease");
    expect(base["_motionReduce"]).toEqual({ animation: "none" });
  });

  // <dialog>의 브라우저 기본 여백이 1em이라, 크기마다 여백을 스스로 정해야 한다.
  it("크기마다 안쪽 여백을 명시한다", () => {
    for (const size of ["sm", "lg"] as const) {
      expect(variants.size[size]).toHaveProperty("padding");
    }
  });
});
