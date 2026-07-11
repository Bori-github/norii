import { useDocumentStore } from "@entities/document";
import { STRINGS } from "@shared/config";
import { bannerActionClass, bannerBodyClass, bannerClass } from "@shared/ui";

import { useConflictStore } from "../model/conflict-store";
import { resolveConflictKeepDisk, resolveConflictKeepMine } from "../model/save-tab";

// 활성 탭의 외부 변경 충돌 배너 — 사용자가 디스크/편집 버전을 명시적으로 고른다
// (자동 병합 금지 → file-lifecycle.md#자동-저장). 스타일은 shared/ui 배너 정의를 공유한다.
export function ConflictBanner() {
  const activeTabId = useDocumentStore((state) => state.activeTabId);
  const conflictTabIds = useConflictStore((state) => state.conflictTabIds);

  if (activeTabId === null || !conflictTabIds.includes(activeTabId)) {
    return null;
  }
  return (
    <div className={bannerClass} role="alert" data-testid="conflict-banner">
      <span className={bannerBodyClass}>
        {STRINGS.conflictTitle} — {STRINGS.conflictBody}
      </span>
      <button
        type="button"
        className={bannerActionClass}
        onClick={() => void resolveConflictKeepMine(activeTabId)}
      >
        {STRINGS.conflictKeepMine}
      </button>
      <button
        type="button"
        className={bannerActionClass}
        onClick={() => void resolveConflictKeepDisk(activeTabId)}
      >
        {STRINGS.conflictKeepDisk}
      </button>
    </div>
  );
}
