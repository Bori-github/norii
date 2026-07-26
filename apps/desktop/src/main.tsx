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
// 설정과 세션은 서로 다른 스토어만 건드리므로 함께 읽는다 — 직렬로 읽으면 첫 페인트가
// 두 상한의 합만큼 늦어진다. 읽기가 던져도 그 단계만 포기한다: 창을 보이는 것과 이후
// 변경을 저장하는 것은 어떤 실패보다 앞선다(숨은 창만 남으면 닫을 수도 없다).
await Promise.all([
  loadSettingsWithin().catch((cause: unknown) => {
    logger.error(`설정을 적용하지 못했습니다 — 기본값으로 시작합니다: ${String(cause)}`);
  }),
  // 지난 세션의 탭까지 세운 뒤에 창을 보인다 — 창이 먼저 뜨면 빈 화면이 탭으로 교체되는
  // 것이 보인다. 여기서도 상한을 넘기면 포기한다.
  restoreSessionWithin().catch((cause: unknown) => {
    logger.error(`지난 세션을 세우지 못했습니다 — 빈 화면으로 시작합니다: ${String(cause)}`);
  }),
]);
persistSettingsOnChange();
persistSessionOnChange();

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
