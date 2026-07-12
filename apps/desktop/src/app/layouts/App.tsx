import { useExternalChanges } from "@features/save-file";
import { EditorPage } from "@pages/editor";

import { exposeE2eApi } from "../lib/expose-e2e-api";
import { useCloseGuard } from "../lib/use-close-guard";
import { useGlobalShortcuts } from "../lib/use-global-shortcuts";
import { AppErrorBoundary } from "./error-boundary";

// E2E 훅 노출은 dev 빌드에서만 동작한다(함수 내부에서 가드).
exposeE2eApi();

// 앱 셸 — 전역 단축키·종료 방어·외부 변경 구독을 걸고 화면 조합은 pages 레이어에 위임한다.
// 에러 바운더리가 렌더 에러로부터 앱 전체를 지킨다(→ error-handling.md).
export function App() {
  useGlobalShortcuts();
  useCloseGuard();
  useExternalChanges();
  return (
    <AppErrorBoundary>
      <EditorPage />
    </AppErrorBoundary>
  );
}
