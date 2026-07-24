import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect } from "react";

import { hasWindowGlass } from "@shared/lib";

// 전체화면에서는 macOS가 표준 창 버튼을 숨긴다 — 유리 크롬 왼쪽의 그 버튼 자리가 빈다. 그 상태를
// 루트 표식(data-fullscreen)으로 알려, 토글이 빈자리 대신 왼쪽 끝에 붙게 한다(→ title-strip).
export function useFullscreenFlag(): void {
  useEffect(() => {
    if (!hasWindowGlass) {
      return;
    }
    const win = getCurrentWindow();

    async function sync(): Promise<void> {
      if (await win.isFullscreen()) {
        document.documentElement.dataset.fullscreen = "on";
      } else {
        delete document.documentElement.dataset.fullscreen;
      }
    }

    void sync();
    // 전체화면 전환은 별도 이벤트 없이 리사이즈로 관측된다.
    const unlisten = win.onResized(() => void sync());
    return () => void unlisten.then((off) => off());
  }, []);
}
