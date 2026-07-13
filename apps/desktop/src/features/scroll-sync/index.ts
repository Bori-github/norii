// Public API — 외부는 이 배럴만 import한다.
export {
  applyGuardedScrollTop,
  createEchoGuard,
  publishScroll,
  resetScrollSync,
  subscribeScroll,
} from "./model/scroll-sync";
export type { EchoGuard, PaneId, ScrollPosition, ScrollTarget } from "./model/scroll-sync";
