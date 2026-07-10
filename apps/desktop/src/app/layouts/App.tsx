import { EditorPage } from "@pages/editor";

import { useGlobalShortcuts } from "../lib/use-global-shortcuts";

// 앱 셸 — 전역 단축키를 걸고 화면 조합은 pages 레이어에 위임한다.
export function App() {
  useGlobalShortcuts();
  return <EditorPage />;
}
