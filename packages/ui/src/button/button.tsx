import type { ButtonHTMLAttributes, ReactNode } from "react";

import { css, cva, cx } from "styled-system/css";

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
      true: {
        borderRadius: "md",
        layerStyle: "focusInside",
      },
    },
  },
  // 배열 밖 값을 spread하면 Panda가 추출하지 못하기 때문에 리터럴로 작성 —
  // px_0.5·px_1이 빠져도 게이트가 못 잡음
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

/** `className`은 배치(margin·정렬)만 받음 — 변형과 같은 속성은 CSS 파일 순서가 결정 */
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
  /** 화면에 글자가 없기 때문에 이 이름이 접근성 이름이 됨 */
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
