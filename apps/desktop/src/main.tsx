import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "@app/index";

// 엔트리 글루 — 레이어 밖의 유일한 파일. 부트스트랩 책임은 app 레이어가 가진다.
const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("root 요소를 찾을 수 없습니다 — index.html과 어긋난 상태");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
