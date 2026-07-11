import { useDocumentStore } from "@entities/document";
import { openPathInTab } from "@features/open-file";

// E2E 전용 훅 — WebDriver(tauri-plugin-webdriver)는 네이티브 다이얼로그를 열 수 없고
// 수정자 키(Cmd/Ctrl)도 합성하지 못하므로, 실전 시나리오는 이 API로 동작을 트리거한다
// (→ .claude/docs/testing.md). dev 빌드에서만 노출된다 — 릴리스 번들에는 포함되지 않는다.
// 표면은 실제 시나리오가 쓰는 것만 유지한다 — 미사용 API를 쌓지 않는다.

interface NoriiE2eApi {
  openPath(path: string): Promise<void>;
  tabCount(): number;
  closeWindow(): void;
}

declare global {
  interface Window {
    noriiE2e?: NoriiE2eApi;
  }
}

export function exposeE2eApi(): void {
  if (!import.meta.env.DEV) {
    return;
  }
  window.noriiE2e = {
    openPath: (path) => openPathInTab(path),
    tabCount: () => useDocumentStore.getState().tabs.length,
    closeWindow: () => {
      // 실제 종료 경로(onCloseRequested → 종료 방어)를 태운다 — destroy가 아니라 close.
      void import("@tauri-apps/api/window").then(({ getCurrentWindow }) =>
        getCurrentWindow().close(),
      );
    },
  };
}
