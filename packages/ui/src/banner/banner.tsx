import type { HTMLAttributes, ReactNode } from "react";

import { css, cva, cx } from "styled-system/css";

export const BANNER_STYLES = {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "4",
    paddingX: "5",
    paddingY: "3",
    background: "bg.paper",
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: "border",
    fontSize: "sm",
    whiteSpace: "pre-line",
    flexWrap: "wrap",
  },
  variants: {
    tone: {
      default: {},
      danger: {
        borderLeftWidth: "3px",
        borderLeftColor: "status.danger",
      },
    },
  },
  defaultVariants: { tone: "default" },
} as const;

// ch는 숫자 0의 폭이라 글자 수와 다름 — 14ch는 123px, 한글로 10자.
export const BANNER_BODY_STYLE = { flex: 1, minWidth: "14ch" } as const;

const BANNER_ACTIONS_STYLE = {
  display: "flex",
  alignItems: "center",
  gap: "2",
  marginLeft: "auto",
  flexWrap: "wrap",
  justifyContent: "flex-end",
} as const;

const bannerRecipe = cva(BANNER_STYLES);
const bodyClass = css(BANNER_BODY_STYLE);
const actionsClass = css(BANNER_ACTIONS_STYLE);

export interface BannerProps extends HTMLAttributes<HTMLDivElement> {
  /** `danger`면 왼쪽에 빨간 띠를 더함 */
  tone?: "default" | "danger";
  children: ReactNode;
}

/** 알림·충돌·삭제됨을 알리는 띠 — 본문은 `BannerBody`, 버튼은 `BannerActions`에 넣어 조립함 */
export function Banner({ tone, className, children, ...rest }: BannerProps) {
  return (
    <div role="alert" className={cx(bannerRecipe({ tone }), className)} {...rest}>
      {children}
    </div>
  );
}

export function BannerBody({ className, children, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cx(bodyClass, className)} {...rest}>
      {children}
    </span>
  );
}

export function BannerActions({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx(actionsClass, className)} {...rest}>
      {children}
    </div>
  );
}
