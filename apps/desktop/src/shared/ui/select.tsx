import type { ReactNode, SelectHTMLAttributes } from "react";

import { css, cx } from "styled-system/css";

// 네이티브 화살표를 끄고(appearance: none) 직접 그린다 — OS마다 모양과 크기가 달라
// 같은 화면에서 컨트롤 높이가 어긋난다.
const wrapClass = css({
  position: "relative",
  display: "inline-flex",
  _after: {
    content: '""',
    position: "absolute",
    top: "50%",
    right: "3",
    width: "6px",
    height: "6px",
    borderRightWidth: "1.5px",
    borderRightStyle: "solid",
    borderRightColor: "text.muted",
    borderBottomWidth: "1.5px",
    borderBottomStyle: "solid",
    borderBottomColor: "text.muted",
    transform: "translateY(-70%) rotate(45deg)",
    pointerEvents: "none",
  },
});

const selectClass = css({
  appearance: "none",
  // 감싸는 상자를 넓혀도 셀렉트가 따라 늘어나야 한다 — 안 그러면 상자 오른쪽에 그린 꺽쇠가
  // 셀렉트에서 떨어져 뜬다. basis는 auto로 둔다(0이면 폭을 안 준 상자가 0으로 접힌다).
  flex: "1 1 auto",
  paddingLeft: "2.5",
  paddingRight: "7",
  paddingY: "1.5",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "border",
  borderRadius: "sm",
  background: "bg.hover",
  color: "text",
  fontFamily: "ui",
  fontSize: "xs",
  cursor: "pointer",
  layerStyle: "focusInside",
});

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  children: ReactNode;
  /** 감싸는 상자에 붙일 배치용 클래스. */
  wrapClassName?: string;
}

export function Select({ children, className, wrapClassName, ...rest }: SelectProps) {
  return (
    <div className={cx(wrapClass, wrapClassName)}>
      <select className={cx(selectClass, className)} {...rest}>
        {children}
      </select>
    </div>
  );
}
