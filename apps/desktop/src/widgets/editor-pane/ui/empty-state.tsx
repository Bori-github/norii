import { css } from "styled-system/css";

import { useDocumentStore } from "@entities/document";
import { useWorkspaceStore } from "@entities/workspace";
import { openFileInteractive, openPathInTab } from "@features/open-file";
import { openFolderInteractive } from "@features/open-folder";
import { STRINGS } from "@shared/config";
import { entryNameOf } from "@shared/lib";
import { Button } from "@shared/ui";

// 빈 상태(탭 0개) — 구성의 단일 출처: document-model.md#빈-탭--탭바는-비지-않는다.

// 빈 상태도 종이다 — 여기가 뚫리면 바탕화면 위에 글자가 뜬다(→ decisions/surface).
const emptyClass = css({
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "6",
  background: "bg.paper",
  color: "text.muted",
});

const columnClass = css({
  display: "flex",
  flexDirection: "column",
  gap: "2",
  width: "60",
});

// 단축키를 오른쪽 끝에 둔다. 정렬은 안쪽 span이 맡는다 — recipe가 정한 justifyContent를
// className으로 덮지 않는다(→ button.tsx).
const actionClass = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  width: "100%",
});

const shortcutClass = css({ color: "text.muted", fontSize: "xs" });

const recentLabelClass = css({ fontSize: "xs", color: "text.muted" });

const recentListClass = css({
  display: "flex",
  flexDirection: "column",
  listStyle: "none",
  margin: 0,
  padding: 0,
});

// 목록 항목은 파일명만 표시하고 전체 경로는 title로 남긴다. 왼쪽 정렬은 안쪽 span이
// 맡는다(→ actionClass와 같은 이유).
const recentItemClass = css({
  width: "100%",
  "& span": {
    width: "100%",
    textAlign: "left",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

export function EmptyState() {
  const recentFiles = useWorkspaceStore((state) => state.recentFiles);
  return (
    <div className={emptyClass} data-testid="empty-state">
      <strong>{STRINGS.emptyStateTitle}</strong>
      <div className={columnClass}>
        <Button data-testid="empty-open-folder" onClick={() => void openFolderInteractive()}>
          {STRINGS.openFolderButtonLabel}
        </Button>
        <Button data-testid="empty-open-file" onClick={() => void openFileInteractive()}>
          <span className={actionClass}>
            {STRINGS.emptyStateOpenFileLabel}
            <kbd className={shortcutClass}>{STRINGS.emptyStateOpenFileShortcut}</kbd>
          </span>
        </Button>
        <Button
          data-testid="empty-new-doc"
          onClick={() => useDocumentStore.getState().addUntitledTab()}
        >
          <span className={actionClass}>
            {STRINGS.emptyStateNewDocLabel}
            <kbd className={shortcutClass}>{STRINGS.emptyStateNewDocShortcut}</kbd>
          </span>
        </Button>
      </div>
      {recentFiles.length > 0 && (
        <div className={columnClass}>
          <span className={recentLabelClass}>{STRINGS.recentFilesLabel}</span>
          <ul className={recentListClass} data-testid="recent-files">
            {recentFiles.map((path) => (
              <li key={path}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={recentItemClass}
                  title={path}
                  onClick={() => void openPathInTab(path)}
                >
                  <span>{entryNameOf(path)}</span>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
