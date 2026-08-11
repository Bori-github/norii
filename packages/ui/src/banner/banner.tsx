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

const bannerRecipe = cva(BANNER_STYLES);
const bodyClass = css({ flex: 1 });

export interface BannerProps extends HTMLAttributes<HTMLDivElement> {
  /** `danger`면 왼쪽에 빨간 띠를 더함. 기본값은 `default` */
  tone?: "default" | "danger";
  children: ReactNode;
}

/** 알림·충돌·삭제됨을 알리는 띠 컴포넌트 */
export function Banner({ tone, className, children, ...rest }: BannerProps) {
  return (
    <div role="alert" className={cx(bannerRecipe({ tone }), className)} {...rest}>
      {children}
    </div>
  );
}

/** `Banner`의 본문을 감싸 남는 자리를 차지하게 하는 요소 — 액션이 오른쪽 끝으로 밀림 */
export function BannerBody({ className, children, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cx(bodyClass, className)} {...rest}>
      {children}
    </span>
  );
}
