import { css, cva } from "styled-system/css";

// 규칙은 decisions/color-palette#탭-상태-점이 소유한다.
export const DOT_STYLES = {
  base: {
    display: "block",
    width: "7px",
    height: "7px",
    borderRadius: "full",
    borderWidth: "0.5px",
    borderStyle: "solid",
    borderColor: "accent.fg",
    outline: "1.5px solid",
    outlineColor: "text",
    outlineOffset: "1.5px",
  },
  variants: {
    status: {
      pending: { background: "accent" },
      alerted: { background: "status.danger" },
    },
  },
} as const;

const dotRecipe = cva(DOT_STYLES);

const slotClass = css({
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "13px",
});

export type TabStatus = "pending" | "alerted";

export function TabStatusDot({ status, label }: { status: TabStatus; label: string }) {
  return (
    <span className={slotClass}>
      <span className={dotRecipe({ status })} role="img" aria-label={label} data-status={status} />
    </span>
  );
}
