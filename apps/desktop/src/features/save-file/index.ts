// Public API — 외부는 이 배럴만 import한다.
export {
  noteDocumentChanged,
  requestCloseTab,
  resolveConflictKeepDisk,
  resolveConflictKeepMine,
  saveTabAs,
  saveTabNow,
} from "./model/save-tab";
export type { SaveOutcome } from "./model/save-tab";
export { ConflictBanner } from "./ui/conflict-banner";
