import { css } from "styled-system/css";

import { useDocumentStore } from "@entities/document";
import { setViewMode, useViewModeStore, type ViewMode } from "@features/switch-view-mode";
import { STRINGS } from "@shared/config";
import { ColumnVerticalIcon, EditIcon, FileEyeIcon, IconButton } from "@shared/ui";

// 뷰 모드 전환 바 — 불투명 표면이다(→ DESIGN.md 표면 표 · preview-strategy.md#뷰-모드).
const barClass = css({
  position: "relative",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "8",
  // 좌우 대칭 여백 — 절대배치 버튼 묶음의 자리를 비워 두면서 제목이 가운데를 지키게 한다.
  paddingX: "28",
  fontSize: "sm",
  background: "bg.paper",
  borderBottomWidth: "1px",
  borderBottomStyle: "solid",
  borderBottomColor: "border",
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
  gap: "0.5",
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
            size="sm"
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
