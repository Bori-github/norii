import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import {
  App,
  applyBootFlags,
  loadSettingsWithin,
  persistSessionOnChange,
  persistSettingsOnChange,
  restoreSessionWithin,
  revealWindow,
} from "@app/index";
import { logger } from "@shared/lib";

// Panda 전역 스타일(리셋·토큰·globalCss) 진입 — 부트스트랩 시 한 번 로드한다.
import "@app/index.css";
// KaTeX 조판 스타일 — CSS와 폰트를 **로컬로 번들**한다. CDN에서 가져오면 CSP(style-src·
// font-src 'self')에 막히고 오프라인에서 수식이 깨진다(→ .claude/docs/security.md).
import "katex/dist/katex.min.css";

// 엔트리 글루 — 레이어 밖의 유일한 파일. 부트스트랩 책임은 app 레이어가 가진다.

// 부팅 순서의 단일 출처: .claude/docs/design/window-chrome.md#부팅-순서--창은-언제-보이는가
// 창을 보이는 것은 어떤 실패보다 앞선다 — 여기서 던지면 숨은 창만 남아 닫을 수도 없다.
try {
  await loadSettingsWithin();
  persistSettingsOnChange();

  // 지난 세션의 탭까지 세운 뒤에 창을 보인다 — 창이 먼저 뜨면 빈 화면이 탭으로 교체되는
  // 것이 보인다. 여기서도 상한을 넘기면 포기한다.
  await restoreSessionWithin();
  persistSessionOnChange();
} catch (cause) {
  logger.error(`부팅 준비 실패 — 기본 상태로 시작합니다: ${String(cause)}`);
}

// 표식(data-theme·data-glass)은 **첫 렌더 전에** 심는다 — 이펙트에서 심으면 한 프레임 동안
// 다크 사용자가 밝은 화면을, 유리 사용자가 불투명 캔버스를 본다(→ app/lib/apply-boot-flags.ts).
applyBootFlags();

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} else {
  logger.error("root 요소를 찾을 수 없습니다 — index.html과 어긋난 상태");
}

revealWindow();
