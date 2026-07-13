import { hasWindowGlass } from "@shared/lib";

import { resolveTheme, useThemeStore } from "@entities/theme";

/**
 * 첫 페인트 전에 루트의 표식(`data-theme`·`data-glass`)을 심는다.
 *
 * 왜 훅이 아니라 부팅 단계인가: 이펙트에서 심으면 **React가 한 번 그린 뒤에** 속성이 붙는다.
 * 그 한 프레임 동안 다크 사용자는 밝은 화면을, 유리 사용자는 불투명 캔버스를 본다 —
 * 투명 창에서는 그게 흰 사각형이 번쩍이는 것으로 보인다.
 *
 * 인라인 스크립트로 `index.html`에서 심는 흔한 방법은 쓸 수 없다 — CSP가 인라인 스크립트를
 * 막는다(→ .claude/docs/security.md). 대신 엔트리가 렌더 전에 이 함수를 부른다.
 *
 * 이후의 변화(OS 테마 변경·사용자 토글)는 `useTheme`이 이어받는다. 유리 표식은 창 설정이
 * 정하므로 런타임에 바뀌지 않는다(→ .claude/docs/design/window-chrome.md).
 */
export function applyBootFlags(): void {
  const { preference, systemPrefersDark } = useThemeStore.getState();
  document.documentElement.dataset.theme = resolveTheme(preference, systemPrefersDark);

  if (hasWindowGlass) {
    document.documentElement.dataset.glass = "on";
  }
}
