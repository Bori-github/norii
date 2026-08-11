import type { ButtonHTMLAttributes, ReactNode } from "react";

import { css, cva, cx } from "styled-system/css";

// 변형이 어느 토큰을 쓰는지는 decisions/color-palette가 소유한다.
export const BUTTON_STYLES = {
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "2",
    borderWidth: "1px",
    borderStyle: "solid",
    borderRadius: "sm",
    cursor: "pointer",
    whiteSpace: "nowrap",
    layerStyle: "focusOutside",
    transitionProperty: "background-color, border-color, color",
    transitionDuration: "fast",
    transitionTimingFunction: "out",
    _motionReduce: { transition: "none" },
    _disabled: {
      cursor: "not-allowed",
      background: "bg.hover",
      color: "text.muted",
      borderColor: "border",
      _hover: { background: "bg.hover" },
    },
  },
  variants: {
    variant: {
      accent: {
        background: "accent",
        color: "accent.fg",
        borderColor: "accent.fg",
        fontWeight: "semibold",
        _hover: { background: "accent.hover" },
        _active: { background: "accent.pressed" },
      },
      outline: {
        background: "transparent",
        color: "text",
        borderColor: "border",
        _hover: { background: "bg.hover" },
      },
      ghost: {
        background: "transparent",
        color: "text",
        borderColor: "transparent",
        _hover: { background: "bg.hover" },
      },
      // 켜짐/꺼짐을 갖는 버튼 — 켜진 것만 본문색이고 나머지는 물러난다.
      toggle: {
        background: "transparent",
        color: "text.muted",
        borderColor: "transparent",
        _hover: { background: "bg.hover", color: "text" },
        "&[aria-pressed='true']": { background: "bg.hover", color: "text" },
      },
    },
    size: {
      "2xs": { paddingX: "1.5", paddingY: "0.5", fontSize: "xs" },
      xs: { paddingX: "2", paddingY: "1", fontSize: "xs" },
      sm: { paddingX: "3", paddingY: "1.5", fontSize: "sm" },
      md: { paddingX: "4", paddingY: "2", fontSize: "sm" },
    },
    icon: {
      // 크롬 끝(배너 오른쪽 · 창 머리)에 붙어 있어 바깥 링이 이웃 테두리를 넘는다.
      true: {
        borderRadius: "md",
        layerStyle: "focusInside",
      },
    },
  },
  // 아이콘 버튼은 정사각이고 크기마다 여백이 다르다 — 아이콘 크기 + 여백 양쪽 + 테두리 양쪽이
  // 곧 한 변이다(20 · 24 · 28 · 30px). Panda가 정적으로 읽어야 하므로 spread로 넘기지 않는다.
  compoundVariants: [
    { icon: true, size: "2xs" as const, css: { paddingX: "0.5", paddingY: "0.5" } },
    { icon: true, size: "xs" as const, css: { paddingX: "1", paddingY: "1" } },
    { icon: true, size: "sm" as const, css: { paddingX: "1.5", paddingY: "1.5" } },
    { icon: true, size: "md" as const, css: { paddingX: "1.5", paddingY: "1.5" } },
  ],
  defaultVariants: { variant: "outline", size: "md" } as const,
};

const buttonRecipe = cva(BUTTON_STYLES);

const iconSizeClass = {
  "2xs": css({ "& svg": { width: "3.5", height: "3.5" } }),
  xs: css({ "& svg": { width: "3.5", height: "3.5" } }),
  sm: css({ "& svg": { width: "3.5", height: "3.5" } }),
  md: css({ "& svg": { width: "4", height: "4" } }),
} as const;

type Variant = "accent" | "outline" | "ghost" | "toggle";
type Size = "2xs" | "xs" | "sm" | "md";

// className은 배치(여백·정렬)만 받는다. 생성된 클래스는 같은 속성을 둘 다 가지면 CSS 파일
// 순서가 결과를 정하므로, 변형이 정한 색·여백을 여기서 덮어쓸 수 없다.
interface CommonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

export type ButtonProps = CommonProps;

export function Button({ variant, size, className, children, ...rest }: ButtonProps) {
  return (
    <button type="button" className={cx(buttonRecipe({ variant, size }), className)} {...rest}>
      {children}
    </button>
  );
}

export interface IconButtonProps extends CommonProps {
  /** 화면에 글자가 없어 이 이름이 접근성 이름이 된다. */
  label: string;
}

export function IconButton({
  variant = "ghost",
  size = "md",
  label,
  className,
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cx(buttonRecipe({ variant, size, icon: true }), iconSizeClass[size], className)}
      {...rest}
    >
      {children}
    </button>
  );
}
