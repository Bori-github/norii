import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import "@app/index.css";

import { css } from "styled-system/css";

import type { Rgb } from "@shared/lib";
import { parseColor } from "@shared/lib";

import { Button } from "@norii/ui";

// 왜: Panda가 만드는 클래스는 원자 단위라, 같은 속성을 정한 클래스가 둘 붙으면 어느 쪽이 이길지를
//     작성 순서가 아니라 CSS 파일 순서가 정한다. 강조 버튼의 라임 채움이 배치용 클래스에 조용히
//     지워지는 일이 실제로 있었고, 설정 객체를 보는 테스트로는 잡히지 않는다.
// 보장: 화면에 실제로 칠해진 색이 액센트 토큰과 같다 — 배치용 클래스를 함께 줘도 그렇다.
// 경계: 그 색이 접근성 기준을 넘는지는 design-tokens.test.ts가 본다.

afterEach(cleanup);

function background(element: Element): Rgb {
  return parseColor(getComputedStyle(element).backgroundColor).rgb;
}

/** Panda가 심은 변수에서 읽는다 — 기대값을 여기 적으면 팔레트를 바꿀 때 함께 낡는다. */
function accentToken(): Rgb {
  const value = getComputedStyle(document.documentElement).getPropertyValue("--colors-accent");
  return parseColor(value.trim()).rgb;
}

it("강조 버튼은 액센트로 칠해진다", () => {
  const { getByRole } = render(<Button variant="accent">저장</Button>);
  expect(background(getByRole("button"))).toEqual(accentToken());
});

// className은 배치(여백·정렬)만 받는다 — 색을 정하는 클래스가 들어오면 여기서 갈린다.
it("배치용 className이 붙어도 채움은 그대로다", () => {
  const { getByRole } = render(
    <Button variant="accent" className={css({ marginLeft: "2" })}>
      저장
    </Button>,
  );
  expect(background(getByRole("button"))).toEqual(accentToken());
});
