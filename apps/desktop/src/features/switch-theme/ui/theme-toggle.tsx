import { css } from "styled-system/css";

import { toggleTheme, useResolvedTheme } from "@entities/theme";
import { STRINGS } from "@shared/config";

// 토글은 유리(상태바) 위에 있다 — 액센트도 흐린 글자도 쓸 수 없다(→ DESIGN.md 불변식).
// 그래서 본문색을 쓰고, 강조는 호버 배경으로만 낸다.
const buttonClass = css({
  display: "flex",
  alignItems: "center",
  gap: "1",
  border: "none",
  background: "transparent",
  color: "text",
  cursor: "pointer",
  paddingX: "1.5",
  paddingY: "0.5",
  borderRadius: "sm",
  fontSize: "xs",
  _hover: { background: "bg.hover" },
  _focusVisible: { outline: "2px solid", outlineColor: "accent", outlineOffset: "-2px" },
});

// 테마 토글 — 지금 보이는 테마의 반대로 고정한다. "OS를 따른다"로 돌아가는 길은
// 설정 화면이 열어 준다(→ entities/theme).
export function ThemeToggle() {
  const theme = useResolvedTheme();
  const goingDark = theme === "light";

  return (
    <button
      type="button"
      className={buttonClass}
      onClick={toggleTheme}
      data-testid="theme-toggle"
      aria-label={goingDark ? STRINGS.themeToDarkLabel : STRINGS.themeToLightLabel}
      title={goingDark ? STRINGS.themeToDarkLabel : STRINGS.themeToLightLabel}
    >
      <span aria-hidden="true">{goingDark ? "◑" : "◐"}</span>
    </button>
  );
}
