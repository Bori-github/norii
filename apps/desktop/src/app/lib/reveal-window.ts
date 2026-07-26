import { getCurrentWindow } from "@tauri-apps/api/window";

import { logger } from "@shared/lib";

/** 숨은 채로 뜬 창을 보인다(→ .claude/docs/design/window-chrome.md#부팅-순서--창은-언제-보이는가). */
export function revealWindow(): void {
  getCurrentWindow()
    .show()
    .catch(() => {
      logger.error("창을 표시하지 못했습니다");
    });
}
