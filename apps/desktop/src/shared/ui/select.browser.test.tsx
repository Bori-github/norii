import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import "@app/index.css";

import { css } from "styled-system/css";

import { Select } from "./select";

// 왜: 꺽쇠는 OS 기본 화살표를 끄고 감싸는 상자에 직접 그린다. 셀렉트가 그 상자를 채우지 않으면
//     꺽쇠만 오른쪽 끝에 남아 셀렉트에서 떨어져 뜬다 — 실제로 그렇게 벌어진 적이 있다.
// 보장: 상자에 폭을 줘도, 안 줘도 셀렉트의 오른쪽 끝과 상자의 오른쪽 끝이 붙어 있다.
// 경계: 꺽쇠의 모양·색은 여기서 보지 않는다.

afterEach(cleanup);

function edges(container: HTMLElement): { wrap: number; select: number } {
  const wrap = container.querySelector("div");
  const select = container.querySelector("select");
  if (!wrap || !select) {
    throw new Error("셀렉트를 찾지 못했습니다");
  }
  return { wrap: wrap.getBoundingClientRect().right, select: select.getBoundingClientRect().right };
}

it("감싸는 상자를 넓혀도 셀렉트가 함께 늘어난다", () => {
  const { container } = render(
    <Select wrapClassName={css({ minWidth: "32" })} aria-label="간격">
      <option>5초</option>
    </Select>,
  );
  const { wrap, select } = edges(container);
  expect(select).toBe(wrap);
});

it("폭을 주지 않으면 내용만큼만 차지한다 — 0으로 접히지 않는다", () => {
  const { container } = render(
    <Select aria-label="간격">
      <option>5초</option>
    </Select>,
  );
  const select = container.querySelector("select");
  expect(select?.getBoundingClientRect().width).toBeGreaterThan(0);
});
