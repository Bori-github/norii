// Public API — 외부는 이 배럴만 import한다.
export {
  createEchoGuard,
  publishScroll,
  resetScrollSync,
  subscribeScroll,
} from "./model/scroll-sync";
export type { EchoGuard, PaneId, ScrollPosition } from "./model/scroll-sync";
