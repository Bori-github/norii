import { css } from "styled-system/css";

import { STRINGS } from "@shared/config";
import { SettingsIcon } from "@shared/ui";

import { openSettings } from "../model/settings-dialog-store";

const buttonClass = css({
  display: "flex",
  padding: "1",
  border: "none",
  borderRadius: "sm",
  background: "transparent",
  color: "text",
  cursor: "pointer",
  _hover: { background: "bg.hover" },
  _focusVisible: { outline: "2px solid", outlineColor: "text", outlineOffset: "-2px" },
  "& svg": { width: "4", height: "4" },
});

export function SettingsButton() {
  return (
    <button
      type="button"
      className={buttonClass}
      data-testid="open-settings"
      aria-label={STRINGS.settingsTitle}
      title={STRINGS.settingsTitle}
      onClick={openSettings}
    >
      <SettingsIcon />
    </button>
  );
}
