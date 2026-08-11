import type { ReactNode, SelectHTMLAttributes } from "react";

import { css, cx } from "styled-system/css";

const wrapClass = css({
  position: "relative",
  display: "inline-flex",
  _after: {
    content: '""',
    position: "absolute",
    top: "50%",
    right: "4",
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
  // basis가 0이면 width를 지정하지 않은 wrapper가 0으로 줄기 때문에 auto로 지정
  flex: "1 1 auto",
  paddingLeft: "3",
  paddingRight: "8",
  paddingY: "2",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "border",
  borderRadius: "sm",
  background: "bg.hover",
  color: "text",
  fontFamily: "ui",
  fontSize: "sm",
  cursor: "pointer",
  layerStyle: "focusOutside",
});

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  children: ReactNode;
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
