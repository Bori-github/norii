import { useDocumentStore } from "@entities/document";
import { STRINGS } from "@shared/config";
import { bannerActionClass, bannerBodyClass, bannerClass } from "@shared/ui";

import { useMissingFileStore } from "../model/missing-file-store";
import { saveTabNow } from "../model/save-tab";

// 활성 탭의 "디스크에서 삭제됨" 배너 — 자동 저장이 멈춘 이유를 알리고, 명시적 저장으로
// 새로 생성하는 입구를 제공한다(→ file-lifecycle.md#외부-변경-처리 file-removed).
export function MissingFileBanner() {
  const activeTabId = useDocumentStore((state) => state.activeTabId);
  const missingTabIds = useMissingFileStore((state) => state.missingTabIds);

  if (activeTabId === null || !missingTabIds.includes(activeTabId)) {
    return null;
  }
  return (
    <div className={bannerClass} role="alert" data-testid="missing-file-banner">
      <span className={bannerBodyClass}>{STRINGS.missingFileBody}</span>
      <button
        type="button"
        className={bannerActionClass}
        onClick={() => void saveTabNow(activeTabId)}
      >
        {STRINGS.missingFileRecreate}
      </button>
    </div>
  );
}
