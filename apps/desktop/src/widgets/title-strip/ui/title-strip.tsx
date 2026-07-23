import { css } from "styled-system/css";

import { SidebarToggle } from "@features/toggle-sidebar";
import { STRINGS } from "@shared/config";

// 타이틀 스트립 — 창 최상단 full-width 유리 띠. 유리에서 상단 36px 네이티브 드래그 띠와 겹치며,
// 그 안에 앱 이름(중앙)과 사이드바 토글(클릭 통과 영역)이 산다. 아래로 사이드바·탭바·본문이
// 온다(→ pages/editor). 계약은 window-chrome.md#계약--드래그-띠가 소유하고, docs-drift가
// TITLEBAR_STRIP_HEIGHT·클릭 통과 영역 좌표와 대조한다.
const titleStripClass = css({
  display: "flex",
  alignItems: "center",
  flexShrink: 0,
  background: "bg.chrome",
  borderBottom: "1px solid",
  borderColor: "border",
  minHeight: "7",
  _glass: { position: "relative", height: "36px", minHeight: "36px" },
});

// 앱 이름은 OS 타이틀 대신 우리가 그린다(hiddenTitle). 왜·창 드래그 규칙은
// window-chrome.md#계약--드래그-띠가 소유한다.
const appNameClass = css({
  display: "none",
  _glass: {
    display: "flex",
    position: "absolute",
    insetInline: 0,
    top: 0,
    height: "36px",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "sm",
    fontWeight: "medium",
    color: "text",
    // 글자는 보이기만 한다 — 마우스는 위에 얹힌 네이티브 띠가 받는다.
    pointerEvents: "none",
    userSelect: "none",
  },
});

// 유리에서는 토글을 드래그 띠의 클릭 통과 영역(→ window-chrome.md#계약--드래그-띠) 자리에
// 절대배치한다. left·width는 titlebar_drag.rs의 그 영역 상수와 같아야 한다(docs-drift가 대조).
// 유리가 꺼지면 스트립 흐름에 선다.
const toggleSlotClass = css({
  display: "flex",
  alignItems: "center",
  flexShrink: 0,
  paddingX: "1",
  _glass: {
    position: "absolute",
    top: 0,
    left: "70px",
    width: "32px",
    height: "36px",
    paddingX: 0,
    justifyContent: "center",
  },
  // 전체화면에선 표준 창 버튼이 숨으므로 그 자리를 비울 필요가 없다 — 왼쪽 끝에 붙인다.
  // 두 속성 선택자라 _glass(속성 하나)보다 특정도가 높아 left를 덮는다.
  '[data-glass="on"][data-fullscreen="on"] &': { left: "8px" },
});

export function TitleStrip() {
  return (
    <div className={titleStripClass} data-testid="title-strip">
      <span className={appNameClass} aria-hidden="true" data-testid="app-name">
        {STRINGS.appName}
      </span>
      <span className={toggleSlotClass}>
        <SidebarToggle />
      </span>
    </div>
  );
}
