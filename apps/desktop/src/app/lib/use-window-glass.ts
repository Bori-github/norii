import { useEffect } from "react";

import { hasWindowGlass } from "@shared/lib";

/**
 * 창 유리 표식을 루트에 심는다 — 캔버스가 투명해질지 여부가 이 한 속성에 달렸다.
 *
 * 컴포넌트는 이 표식을 알지 못한다. 시맨틱 토큰(`bg.canvas`)이 값을 갈라 주고,
 * 나머지 표면(종이·크롬·떠 있는 면)은 플랫폼과 무관하다
 * (→ .claude/docs/design/window-chrome.md#웹-쪽-계약--캔버스만-갈라진다).
 */
export function useWindowGlass(): void {
  useEffect(() => {
    if (hasWindowGlass) {
      document.documentElement.dataset.glass = "on";
    } else {
      delete document.documentElement.dataset.glass;
    }
  }, []);
}
