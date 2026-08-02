import type { CSSProperties, ReactNode } from "react";
import { css, cx } from "styled-system/css";

// 대상 바로 아래에 겹쳐 뜬다 — 흐름에 끼우면 뜨고 사라질 때마다 주변이 밀린다.
// 자리는 부르는 쪽이 정한다: 기준이 될 요소에 position: relative를 주고 className으로 좌우를 맞춘다.

const POINTER_X = "--norii-tooltip-pointer-x";

const tooltipClass = css({
  position: "absolute",
  top: "100%",
  zIndex: 1,
  marginTop: "1px",
  paddingX: "3",
  paddingY: "1.5",
  borderRadius: "md",
  fontSize: "xs",
  fontWeight: "medium",
  whiteSpace: "nowrap",
  color: "white",
  background: "status.danger",
  // 가상 요소라 props로 클래스를 바꿀 수 없어 사용자 정의 속성을 거친다.
  _before: {
    content: '""',
    position: "absolute",
    bottom: "100%",
    left: `var(${POINTER_X}, 50%)`,
    transform: "translateX(-50%)",
    borderLeftWidth: "5px",
    borderRightWidth: "5px",
    borderBottomWidth: "5px",
    borderStyle: "solid",
    borderColor: "transparent",
    borderBottomColor: "status.danger",
  },
});

/**
 * `id`는 대상의 `aria-describedby`와 잇는다 — 잇지 않으면 스크린리더가 이 글을 읽지 않는다.
 * `pointerX`는 툴팁 왼쪽 끝에서 잰 꼭짓점의 가운데 위치다(CSS 길이·백분율, 기본 50%).
 */
export function Tooltip({
  id,
  className,
  pointerX,
  children,
  ...rest
}: {
  id?: string;
  className?: string;
  pointerX?: string;
  children: ReactNode;
} & { "data-testid"?: string }) {
  return (
    <span
      id={id}
      className={cx(tooltipClass, className)}
      style={pointerX === undefined ? undefined : ({ [POINTER_X]: pointerX } as CSSProperties)}
      {...rest}
    >
      {children}
    </span>
  );
}
