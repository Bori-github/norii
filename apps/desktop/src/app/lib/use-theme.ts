import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect } from "react";

import { DARK_QUERY, useResolvedTheme, useThemeStore } from "@entities/theme";
import { logger } from "@shared/lib";

/**
 * 테마 **변화**를 화면에 흘린다 — OS 설정이 바뀌거나 사용자가 토글하면 루트의 `data-theme`을 갱신한다.
 *
 * 첫 값은 이 훅이 심지 않는다. 렌더 전에 부팅 단계가 이미 심어 뒀다(→ app/lib/apply-boot-flags.ts) —
 * 이펙트에서 처음 심으면 한 프레임 동안 다크 사용자가 밝은 화면을 본다.
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

    // 창(NSAppearance)에도 같은 테마를 알린다 — macOS의 타이틀바·신호등은 **OS 테마**를 따르므로,
    // 앱만 다크로 바꾸면 밝은 타이틀바 아래 어두운 크롬이 붙어 상단이 갈라진다(실측: 단차 146).
    // 창 테마를 맞추면 타이틀바·유리가 함께 따라온다.
    void getCurrentWindow()
      .setTheme(theme)
      .catch(() => {
        logger.error("창 테마를 적용하지 못했습니다");
      });
  }, [theme]);
}
