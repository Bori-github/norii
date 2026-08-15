// 유리 값의 기본 — 계약은 .claude/docs/design/window-chrome.md와 decisions/glass.md가 소유한다.

export { GLASS_OPACITY_DEFAULT } from "@norii/ui/panda-preset";

/** 흐림 반경 — Rust `window_glass.rs`가 같은 값을 갖고, `docs-drift`가 둘을 대조한다. */
export const BLUR_RADIUS_DEFAULT = 30;
export const BLUR_RADIUS_MAX = 100;
