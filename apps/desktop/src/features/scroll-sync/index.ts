// Public API — 외부는 이 배럴만 import한다.
export {
  applyGuardedScrollTop,
  createEchoGuard,
  createSwapSuppressor,
  publishScroll,
  resetScrollSync,
  subscribeScroll,
} from "./model/scroll-sync";
export type {
  EchoGuard,
  PaneId,
  ScrollPosition,
  ScrollTarget,
  SwapSuppressor,
} from "./model/scroll-sync";
