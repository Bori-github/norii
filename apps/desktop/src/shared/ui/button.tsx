import type { ButtonHTMLAttributes, ReactNode } from "react";

import { css, cva, cx } from "styled-system/css";

// 변형이 어느 토큰을 쓰는지는 decisions/color-palette가 소유한다.
export const BUTTON_STYLES = {
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "1.5",
    borderWidth: "1px",
    borderStyle: "solid",
    borderRadius: "sm",
    cursor: "pointer",
    whiteSpace: "nowrap",
    layerStyle: "focusOutside",
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
    },
    size: {
      sm: { paddingX: "2", paddingY: "1", fontSize: "xs" },
      md: { paddingX: "3", paddingY: "1.5", fontSize: "sm" },
    },
    icon: {
      true: { paddingX: "1.5", paddingY: "1.5" },
    },
  },
  defaultVariants: { variant: "outline", size: "md" },
} as const;

const buttonRecipe = cva(BUTTON_STYLES);

const iconSizeClass = {
  sm: css({ "& svg": { width: "3.5", height: "3.5" } }),
  md: css({ "& svg": { width: "4", height: "4" } }),
} as const;

type Variant = "accent" | "outline" | "ghost";
type Size = "sm" | "md";

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
