// 유리 값의 기본 — 계약은 .claude/docs/design/window-chrome.md와 decisions/glass.md가 소유한다.

/**
 * 크롬 틴트의 기본 알파. `panda.config.ts`가 `bg.chrome` 토큰의 기본값으로 쓰고,
 * 설정 슬라이더가 아직 고르지 않은 상태의 표시값으로 읽는다.
 *
 * 두 테마의 값이 다른 것은 대비 게이트의 계산 결과다(→ design-system.md#대비-게이트).
 */
export const GLASS_OPACITY_DEFAULT = { light: 0.5, dark: 0.6 } as const;

/** 흐림 반경 — Rust `window_glass.rs`가 같은 값을 갖고, `docs-drift`가 둘을 대조한다. */
export const BLUR_RADIUS_DEFAULT = 30;
export const BLUR_RADIUS_MAX = 100;
