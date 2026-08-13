import { describe, expect, it } from "vitest";

import { DIALOG_STYLES } from "./dialog";

// 왜: prefers-reduced-motion은 브라우저 테스트에서 켤 수 없어 여기서만 확인할 수 있다.
// 경계: 계산된 값으로 확인할 수 있는 것(여백·구분선·딤)은 dialog.stories.tsx가 렌더해서 본다.

const { base } = DIALOG_STYLES;

describe("다이얼로그", () => {
  it("모션을 줄이는 설정에서는 진입 모션을 끈다", () => {
    expect(base.animation).toBe("dialogIn 0.16s ease");
    expect(base["_motionReduce"]).toEqual({ animation: "none" });
  });
});
