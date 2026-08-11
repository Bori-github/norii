import type { CSSProperties, ReactNode } from "react";
import { css, cx } from "styled-system/css";

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
  color: "status.dangerFg",
  background: "status.dangerSurface",
  // 꼭짓점은 ::before라 props를 받을 수 없기 때문에 CSS 사용자 정의 속성으로 전달
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
    borderBottomColor: "status.dangerSurface",
  },
});

/**
 * 대상 요소 아래에 겹쳐 뜨는 안내 문구 컴포넌트
 *
 * @param id - 대상의 `aria-describedby`와 연결할 값. 연결하지 않으면 스크린리더가 읽지 않음
 * @param pointerX - 툴팁 왼쪽 끝을 기준으로 한 꼭짓점 중앙 위치(CSS 길이·백분율, 기본 50%)
 *
 * @description
 * 툴팁을 붙일 요소에 `position: relative`를 지정해야 함 — 없으면 가장 가까운 positioned
 * 조상을 기준으로 배치
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
