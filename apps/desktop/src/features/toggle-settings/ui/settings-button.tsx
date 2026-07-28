import { STRINGS } from "@shared/config";
import { IconButton, SettingsIcon } from "@shared/ui";

import { openSettings } from "../model/settings-dialog-store";

export function SettingsButton() {
  return (
    <IconButton
      data-testid="open-settings"
      label={STRINGS.settingsTitle}
      title={STRINGS.settingsTitle}
      onClick={openSettings}
    >
      <SettingsIcon />
    </IconButton>
  );
}
