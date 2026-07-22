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
  paddingX: "2",
  fontSize: "sm",
  background: "bg.paper",
  borderBottom: "1px solid",
  borderColor: "border",
});

const titleClass = css({
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
