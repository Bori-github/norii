export { findTab, useDocumentStore } from "./model/document-store";
export type { DocumentStore } from "./model/document-store";
export {
  getInitialText,
  getTabText,
  notifyDocChanged,
  registerTabTextHandle,
  resetTabTextRegistry,
  setTabText,
  subscribeDocChanged,
  unregisterTabTextHandle,
} from "./model/text-access";
export type { TabTextHandle } from "./model/text-access";
export { needsNormalizationApproval } from "./model/types";
export type { Tab } from "./model/types";
