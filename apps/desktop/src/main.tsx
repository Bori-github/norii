import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App, applyBootFlags } from "@app/index";

// Panda 전역 스타일(리셋·토큰·globalCss) 진입 — 부트스트랩 시 한 번 로드한다.
import "@app/index.css";

// 엔트리 글루 — 레이어 밖의 유일한 파일. 부트스트랩 책임은 app 레이어가 가진다.

// 표식(data-theme·data-glass)은 **첫 렌더 전에** 심는다 — 이펙트에서 심으면 한 프레임 동안
// 다크 사용자가 밝은 화면을, 유리 사용자가 불투명 캔버스를 본다(→ app/lib/apply-boot-flags.ts).
applyBootFlags();

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("root 요소를 찾을 수 없습니다 — index.html과 어긋난 상태");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
