import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import "@app/index.css";

import { CloseIcon } from "./icons";

import { IconButton } from "./button";

// 왜: 아이콘 버튼의 여백은 compoundVariants가 정한다. 그 부분을 cva에 spread로 넘기면 Panda가
//     정적으로 읽지 못해 클래스 이름만 붙고 규칙이 생성되지 않는다 — 실제로 그렇게 xs가
//     16×20으로 찌그러졌다. 화면에 그려진 크기로만 잡을 수 있다.
// 보장: 네 크기가 정사각이고, 작을수록 작다.
// 경계: 어느 화면이 어느 크기를 쓰는지는 각 호출부가 정한다.

afterEach(cleanup);

function box(size: "2xs" | "xs" | "sm" | "md"): string {
  const { container } = render(
    <IconButton size={size} label={size}>
      <CloseIcon />
    </IconButton>,
  );
  const rect = container.querySelector("button")?.getBoundingClientRect();
  return `${Math.round(rect?.width ?? 0)}x${Math.round(rect?.height ?? 0)}`;
}

it("아이콘 버튼은 크기마다 정사각이다", () => {
  expect([box("2xs"), box("xs"), box("sm"), box("md")]).toEqual([
    "20x20",
    "24x24",
    "28x28",
    "30x30",
  ]);
});
