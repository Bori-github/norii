import { css } from "styled-system/css";

import { STRINGS } from "@shared/config";
import { PanelLeftIcon } from "@shared/ui";

import { toggleSidebar, useSidebarStore } from "../model/sidebar-store";

const buttonClass = css({
  display: "flex",
  alignItems: "center",
  border: "none",
  background: "transparent",
  color: "text",
  cursor: "pointer",
  paddingX: "1.5",
  paddingY: "0.5",
  borderRadius: "sm",
  _hover: { background: "bg.hover" },
  _focusVisible: { outline: "2px solid", outlineColor: "accent", outlineOffset: "-2px" },
  "&[aria-pressed='true'] [data-pane]": { fill: "currentColor", fillOpacity: 0.25 },
  "& svg": { width: "4", height: "4" },
});

export function SidebarToggle() {
  const visible = useSidebarStore((state) => state.visible);
  const label = visible ? STRINGS.sidebarHideLabel : STRINGS.sidebarShowLabel;

  return (
    <button
      type="button"
      className={buttonClass}
      onClick={toggleSidebar}
      data-testid="sidebar-toggle"
      aria-pressed={visible}
      aria-label={label}
      title={label}
    >
      <PanelLeftIcon />
    </button>
  );
}
