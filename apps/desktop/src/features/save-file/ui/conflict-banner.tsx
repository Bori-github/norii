import { css } from "styled-system/css";

import { useDocumentStore } from "@entities/document";
import { STRINGS } from "@shared/config";

import { useConflictStore } from "../model/conflict-store";
import { resolveConflictKeepDisk, resolveConflictKeepMine } from "../model/save-tab";

const bannerClass = css({
  display: "flex",
  alignItems: "center",
  gap: "3",
  paddingX: "4",
  paddingY: "2",
  background: "bg.surface",
  borderBottom: "1px solid",
  borderColor: "border",
  fontSize: "sm",
  whiteSpace: "pre-line",
});

const actionClass = css({
  flexShrink: 0,
  paddingX: "2",
  paddingY: "1",
  border: "1px solid",
  borderColor: "border",
  borderRadius: "sm",
  cursor: "pointer",
  background: "transparent",
  color: "accent",
  _hover: { background: "bg.canvas" },
});

// 활성 탭의 외부 변경 충돌 배너 — 사용자가 디스크/편집 버전을 명시적으로 고른다
// (자동 병합 금지 → file-lifecycle.md#자동-저장).
export function ConflictBanner() {
  const activeTabId = useDocumentStore((state) => state.activeTabId);
  const conflictTabIds = useConflictStore((state) => state.conflictTabIds);

  if (activeTabId === null || !conflictTabIds.includes(activeTabId)) {
    return null;
  }
  return (
    <div className={bannerClass} role="alert" data-testid="conflict-banner">
      <span className={css({ flex: 1 })}>
        {STRINGS.conflictTitle} — {STRINGS.conflictBody}
      </span>
      <button
        type="button"
        className={actionClass}
        onClick={() => void resolveConflictKeepMine(activeTabId)}
      >
        {STRINGS.conflictKeepMine}
      </button>
      <button
        type="button"
        className={actionClass}
        onClick={() => void resolveConflictKeepDisk(activeTabId)}
      >
        {STRINGS.conflictKeepDisk}
      </button>
    </div>
  );
}
