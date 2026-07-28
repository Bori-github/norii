import { css } from "styled-system/css";

import { STRINGS } from "@shared/config";
import { IconButton, PanelLeftIcon } from "@shared/ui";

import { toggleSidebar, useSidebarStore } from "../model/sidebar-store";

// 눌린 상태에서 아이콘의 패널 면을 채워 사이드바가 열려 있음을 나타낸다.
const pressedPaneClass = css({
  "&[aria-pressed='true'] [data-pane]": { fill: "currentColor", fillOpacity: 0.25 },
});

export function SidebarToggle() {
  const visible = useSidebarStore((state) => state.visible);
  const label = visible ? STRINGS.sidebarHideLabel : STRINGS.sidebarShowLabel;

  return (
    <IconButton
      className={pressedPaneClass}
      onClick={toggleSidebar}
      data-testid="sidebar-toggle"
      aria-pressed={visible}
      label={label}
      title={label}
    >
      <PanelLeftIcon />
    </IconButton>
  );
}
