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
    // 자리가 모자라면 액션이 상자 밖으로 나가 누를 수 없기 때문에 아랫줄로 내림
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

// flex만 두면 본문이 한 글자 폭까지 줄어 wrap이 걸리지 않기 때문에 하한을 둠.
// ch는 숫자 0의 폭이라 글자 수와 다름 — 14ch는 123px, 한글로 10자.
export const BANNER_BODY_STYLE = { flex: 1, minWidth: "14ch" } as const;

const bannerRecipe = cva(BANNER_STYLES);
const bodyClass = css(BANNER_BODY_STYLE);

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
