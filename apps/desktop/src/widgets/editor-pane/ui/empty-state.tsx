import { css } from "styled-system/css";

import { useDocumentStore } from "@entities/document";
import { openFileInteractive } from "@features/open-file";
import { openFolderInteractive } from "@features/open-folder";
import { STRINGS } from "@shared/config";
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

const headingClass = css({ fontSize: "md", fontWeight: "semibold", textAlign: "center" });

const columnClass = css({
  display: "flex",
  flexDirection: "column",
  gap: "1",
  width: "80",
});

const rowClass = css({ width: "100%" });

const actionClass = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  width: "100%",
});

const shortcutGroupClass = css({ display: "flex", alignItems: "center", gap: "1" });

const shortcutKeyClass = css({
  fontFamily: "editor",
  fontSize: "xs",
  color: "accent.fg",
  paddingBlock: "0.5",
  paddingInline: "1",
  minWidth: "5",
  textAlign: "center",
  borderRadius: "sm",
  background: "accent",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "accent.pressed",
  borderBottomWidth: "2px",
});

function ShortcutKeys({ keys }: { keys: string }) {
  return (
    <span className={shortcutGroupClass}>
      {[...keys].map((key) => (
        <kbd key={key} className={shortcutKeyClass}>
          {key}
        </kbd>
      ))}
    </span>
  );
}

export function EmptyState() {
  return (
    <div className={emptyClass} data-testid="empty-state">
      <strong className={headingClass}>{STRINGS.emptyStateTitle}</strong>
      <div className={columnClass}>
        <Button
          variant="accent"
          data-testid="empty-open-folder"
          onClick={() => void openFolderInteractive()}
        >
          {STRINGS.openFolderButtonLabel}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={rowClass}
          data-testid="empty-open-file"
          onClick={() => void openFileInteractive()}
        >
          <span className={actionClass}>
            {STRINGS.emptyStateOpenFileLabel}
            <ShortcutKeys keys={STRINGS.emptyStateOpenFileShortcut} />
          </span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={rowClass}
          data-testid="empty-new-doc"
          onClick={() => useDocumentStore.getState().addUntitledTab()}
        >
          <span className={actionClass}>
            {STRINGS.emptyStateNewDocLabel}
            <ShortcutKeys keys={STRINGS.emptyStateNewDocShortcut} />
          </span>
        </Button>
      </div>
    </div>
  );
}
