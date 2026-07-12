import { useEffect } from "react";

import { useResolvedTheme, useThemeStore } from "@entities/theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * 테마를 화면에 적용한다 — 루트 요소의 `data-theme`을 심고, OS 설정 변경을 스토어에 흘린다.
 *
 * Panda의 다크 조건이 `[data-theme="dark"] &`라 이 속성 하나가 앱 전체의 색을 갈아끼운다.
 * CM6 에디터도 CSS 변수를 참조하므로 함께 따라온다 — 에디터를 다시 만들지 않는다
 * (→ .claude/docs/design/design-system.md#테마-라이트다크).
 */
export function useTheme(): void {
  const setSystemPrefersDark = useThemeStore((state) => state.setSystemPrefersDark);
  const theme = useResolvedTheme();

  // OS 설정을 읽고, 이후 변경도 따라간다 — preference가 system일 때만 화면에 반영된다.
  useEffect(() => {
    const media = globalThis.matchMedia(DARK_QUERY);
    setSystemPrefersDark(media.matches);

    const onChange = (event: MediaQueryListEvent): void => {
      setSystemPrefersDark(event.matches);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [setSystemPrefersDark]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
}
