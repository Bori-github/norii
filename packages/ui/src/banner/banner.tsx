import type { HTMLAttributes, ReactNode } from "react";

import { css, cva, cx } from "styled-system/css";

// 배너는 떠 있지 않다 — 레이아웃을 미는 in-flow 띠라 흐릴 대상도 없다. 그래서 불투명(종이)이고,
// 아래 편집면과는 경계선으로 갈린다(→ DESIGN.md 표면 표).
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
      // 사용자 개입이 필요한 배너(충돌·삭제됨)만 쓴다. 안내 배너는 기본 모습을 그대로 둔다 —
      // 전부 빨갛게 하면 "빨강 = 지금 손대야 함"이 흐려진다.
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
  tone?: "default" | "danger";
  children: ReactNode;
}

/** 알림 띠. 본문은 `BannerBody`로 감싸고, 액션은 그 뒤에 둔다. */
export function Banner({ tone, className, children, ...rest }: BannerProps) {
  return (
    <div role="alert" className={cx(bannerRecipe({ tone }), className)} {...rest}>
      {children}
    </div>
  );
}

/** 남는 자리를 채우는 본문 — 액션 버튼을 오른쪽 끝으로 민다. */
export function BannerBody({ className, children, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cx(bodyClass, className)} {...rest}>
      {children}
    </span>
  );
}
