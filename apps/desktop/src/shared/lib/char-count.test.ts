import { describe, expect, it } from "vitest";

import { countChars } from "./char-count";

// 왜: 상태바가 보여주는 자 수의 계산 규칙은 코드가 아니라 여기서 읽혀야 한다.
//     "무엇을 보장하나" — 공백·줄바꿈을 포함한 전체 글자 수다. 자소 결합·이모지 시퀀스는
//     한 글자다.
//     "경계" — 계산만 검증한다. 언제 다시 계산하는지(디바운스)는 배선 쪽 몫이다.
describe("countChars", () => {
  it("빈 문서는 0이다", () => {
    expect(countChars("")).toBe(0);
  });

  it("공백·줄바꿈도 글자다", () => {
    expect(countChars("가 나\n다")).toBe(5);
  });

  it("결합 이모지도 한 글자다 — 자소 단위가 아니라 눈에 보이는 글자 단위로 센다", () => {
    expect(countChars("👍🏽")).toBe(1);
  });
});
