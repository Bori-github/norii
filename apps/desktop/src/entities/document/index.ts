// Public API — 외부는 이 배럴만 import한다.
export { findTab, useDocumentStore } from "./model/document-store";
export type { DocumentStore } from "./model/document-store";
export {
  getInitialText,
  getTabText,
  registerTabTextHandle,
  setTabText,
  unregisterTabTextHandle,
} from "./model/text-access";
export type { TabTextHandle } from "./model/text-access";
export type { Tab } from "./model/types";
