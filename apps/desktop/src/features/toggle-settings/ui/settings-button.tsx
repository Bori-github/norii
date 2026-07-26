import { css } from "styled-system/css";

import { STRINGS } from "@shared/config";
import { SlidersIcon } from "@shared/ui";

import { openSettings } from "../model/settings-dialog-store";

const buttonClass = css({
  display: "flex",
  alignItems: "center",
  gap: "1.5",
  width: "full",
  paddingX: "2",
  paddingY: "1.5",
  border: "none",
  borderRadius: "sm",
  background: "transparent",
  color: "text",
  fontSize: "xs",
  cursor: "pointer",
  _hover: { background: "bg.hover" },
  _focusVisible: { outline: "2px solid", outlineColor: "accent", outlineOffset: "-2px" },
  "& svg": { width: "4", height: "4", flexShrink: 0 },
});

export function SettingsButton() {
  return (
    <button
      type="button"
      className={buttonClass}
      data-testid="open-settings"
      aria-label={STRINGS.settingsTitle}
      onClick={openSettings}
    >
      <SlidersIcon />
      {STRINGS.settingsTitle}
    </button>
  );
}
