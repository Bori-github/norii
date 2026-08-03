import { css } from "styled-system/css";

import { useDocumentStore } from "@entities/document";
import { setViewMode, useViewModeStore, type ViewMode } from "@features/switch-view-mode";
import { STRINGS } from "@shared/config";
import { ColumnVerticalIcon, EditIcon, FileEyeIcon, IconButton } from "@shared/ui";

// 뷰 모드 전환 바 — 불투명 표면이다(→ DESIGN.md 표면 표 · preview-strategy.md#뷰-모드).
const barClass = css({
  display: "grid",
  gridTemplateColumns: "1fr auto 1fr",
  alignItems: "center",
  height: "8",
  paddingX: "3",
  fontSize: "sm",
  background: "bg.paper",
  borderBottomWidth: "1px",
  borderBottomStyle: "solid",
  borderBottomColor: "border",
});

const titleClass = css({
  gridColumn: 2,
  minWidth: 0,
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
  color: "text.muted",
});

const buttonsClass = css({
  gridColumn: 3,
  display: "inline-flex",
  justifySelf: "end",
  gap: "1.5",
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
          <IconButton
            key={target}
            variant="toggle"
            size="xs"
            label={label}
            title={label}
            aria-pressed={mode === target}
            onClick={() => setViewMode(target)}
          >
            <Icon />
          </IconButton>
        ))}
      </span>
    </div>
  );
}
