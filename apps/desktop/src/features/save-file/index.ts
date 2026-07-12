// Public API — 외부는 이 배럴만 import한다.
export { useExternalChanges } from "./model/external-changes";
export {
  approveTabNormalization,
  noteDocumentChanged,
  requestCloseTab,
  resolveConflictKeepDisk,
  resolveConflictKeepMine,
  saveTabAs,
  saveTabNow,
} from "./model/save-tab";
export type { SaveOutcome } from "./model/save-tab";
// 탭바(⚠ 배지)가 구독하는 상태 — 배너는 활성 탭 전용이라 비활성 탭 상태는 배지가 알린다.
export { useConflictStore } from "./model/conflict-store";
export { useMissingFileStore } from "./model/missing-file-store";
export { ConflictBanner } from "./ui/conflict-banner";
export { MissingFileBanner } from "./ui/missing-file-banner";
