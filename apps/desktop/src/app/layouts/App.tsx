import { EditorPage } from "@pages/editor";

import { useCloseGuard } from "../lib/use-close-guard";
import { useGlobalShortcuts } from "../lib/use-global-shortcuts";
import { AppErrorBoundary } from "./error-boundary";

// 앱 셸 — 전역 단축키·종료 방어를 걸고 화면 조합은 pages 레이어에 위임한다.
// 에러 바운더리가 렌더 에러로부터 앱 전체를 지킨다(→ error-handling.md).
export function App() {
  useGlobalShortcuts();
  useCloseGuard();
  return (
    <AppErrorBoundary>
      <EditorPage />
    </AppErrorBoundary>
  );
}
