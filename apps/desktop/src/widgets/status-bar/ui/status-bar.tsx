import { css } from "styled-system/css";

import { ThemeToggle } from "@features/switch-theme";

// 상태바는 유리(크롬)다 — 창 가장자리에 닿고 뒤가 바탕화면이다(→ DESIGN.md 표면 표).
// 탭이 없어도 항상 보이므로 테마 토글의 자리로 삼는다.
// 인코딩·EOL·커서 위치는 이후 마일스톤에서 여기 들어온다(→ file-lifecycle.md, document-model.md).
const barClass = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "2",
  paddingX: "2",
  paddingY: "0.5",
  minHeight: "6",
  background: "bg.chrome",
  borderTop: "1px solid",
  borderColor: "border",
});

export function StatusBar() {
  return (
    <div className={barClass} data-testid="status-bar">
      <ThemeToggle />
    </div>
  );
}
