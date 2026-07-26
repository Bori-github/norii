import { getCurrentWindow } from "@tauri-apps/api/window";

import { logger } from "@shared/lib";

/** 창을 보인다(→ .claude/docs/design/window-chrome.md#부팅-순서--창은-언제-보이는가). */
export function revealWindow(): void {
  // 프레임을 기다리지 않는다 — 보이지 않는 창의 웹뷰는 그리지 않으므로
  // requestAnimationFrame이 오지 않고, 기다리면 창을 끝내 보이지 못한다.
  getCurrentWindow()
    .show()
    .catch(() => {
      logger.error("창을 표시하지 못했습니다");
    });
}
