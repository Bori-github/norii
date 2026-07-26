import { useEffect } from "react";

import { useGlassStore } from "@entities/glass";
import { ipc } from "@shared/ipc";
import { hasWindowGlass, logger } from "@shared/lib";

/**
 * 유리 설정을 화면과 창에 흘린다 — 알파는 CSS 변수로, 흐림 반경은 커맨드로 간다.
 *
 * 두 값이 다른 경로를 타는 이유는 그리는 주체가 다르기 때문이다. 크롬 틴트는 웹뷰가 그리고,
 * 창 뒤 흐림은 OS 합성기가 그린다(→ .claude/docs/design/decisions/glass.md).
 */
export function useGlassSettings(): void {
  const opacity = useGlassStore((state) => state.opacity);
  const blurRadius = useGlassStore((state) => state.blurRadius);

  useEffect(() => {
    const { style } = document.documentElement;
    // 변수를 지우면 토큰의 기본값이 되살아난다 — 테마별로 다른 그 값을 여기서 다시 쓰지 않는다.
    if (opacity === null) {
      style.removeProperty("--norii-glass-opacity");
    } else {
      style.setProperty("--norii-glass-opacity", String(opacity));
    }
  }, [opacity]);

  useEffect(() => {
    if (!hasWindowGlass) {
      return;
    }
    ipc.setWindowBlurRadius(blurRadius).catch(() => {
      logger.error("창 뒤 흐림 반경을 적용하지 못했습니다");
    });
  }, [blurRadius]);
}
