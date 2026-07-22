import { css } from "styled-system/css";

import { useDocumentStore } from "@entities/document";
import { setViewMode, useViewModeStore, type ViewMode } from "@features/switch-view-mode";
import { STRINGS } from "@shared/config";
import { ColumnVerticalIcon, EditIcon, FileEyeIcon } from "@shared/ui";

// 뷰 모드 전환 바 — 불투명 표면이다(→ DESIGN.md 표면 표 · preview-strategy.md#뷰-모드).
const barClass = css({
  position: "relative",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "7",
  // 좌우 대칭 여백 — 절대배치 버튼 묶음의 자리를 비워 두면서 제목이 가운데를 지키게 한다.
  paddingX: "28",
  fontSize: "sm",
  background: "bg.paper",
  borderBottom: "1px solid",
  borderColor: "border",
});

const titleClass = css({
  minWidth: 0,
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
  color: "text.muted",
});

const buttonsClass = css({
  position: "absolute",
  right: "2",
  display: "inline-flex",
  border: "1px solid",
  borderColor: "border",
  borderRadius: "md",
  overflow: "hidden",
});

const buttonClass = css({
  display: "inline-flex",
  alignItems: "center",
  paddingX: "1.5",
  paddingY: "0.5",
  color: "text.muted",
  cursor: "pointer",
  _hover: { background: "bg.hover" },
  // 안쪽 링 — 묶음의 overflow: hidden이 바깥 윤곽을 잘라내므로 안쪽에 그린다.
  _focusVisible: { outline: "2px solid", outlineColor: "accent", outlineOffset: "-2px" },
  "&[aria-pressed='true']": { background: "bg.hover", color: "text" },
  "& svg": { width: "4", height: "4" },
  "& + &": { borderLeft: "1px solid", borderColor: "border" },
});

const MODES: { mode: ViewMode; label: string; Icon: typeof EditIcon }[] = [
  { mode: "editor", label: STRINGS.viewModeEditorLabel, Icon: EditIcon },
  { mode: "split", label: STRINGS.viewModeSplitLabel, Icon: ColumnVerticalIcon },
  { mode: "preview", label: STRINGS.viewModePreviewLabel, Icon: FileEyeIcon },
];

export function ViewModeBar() {
  const activeTab = useDocumentStore((state) =>
    state.tabs.find((tab) => tab.id === state.activeTabId),
  );
  const mode = useViewModeStore((state) => state.mode);

  if (!activeTab) {
    return null;
  }

  return (
    <div className={barClass} data-testid="view-mode-bar">
      <span className={titleClass}>{activeTab.title}</span>
      <span className={buttonsClass} role="group" aria-label={STRINGS.viewModeGroupLabel}>
        {MODES.map(({ mode: target, label, Icon }) => (
          <button
            key={target}
            type="button"
            className={buttonClass}
            aria-pressed={mode === target}
            aria-label={label}
            title={label}
            onClick={() => setViewMode(target)}
          >
            <Icon aria-hidden="true" />
          </button>
        ))}
      </span>
    </div>
  );
}
