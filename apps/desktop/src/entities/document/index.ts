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
export {
  clearTabViewState,
  getTabScroll,
  resetTabViewStates,
  setTabScroll,
} from "./model/tab-view-state";
export type { TabScroll } from "./model/tab-view-state";
export { needsNormalizationApproval } from "./model/types";
export type { Tab } from "./model/types";
