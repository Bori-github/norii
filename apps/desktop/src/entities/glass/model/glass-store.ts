import { create } from "zustand";

import { BLUR_RADIUS_DEFAULT, BLUR_RADIUS_MAX, GLASS_OPACITY_DEFAULT } from "@shared/config";

// 유리 값의 단일 소유자 — entities가 갖고 app이 화면·창에 적용한다
// (→ .claude/docs/frontend-architecture.md).
//
// 고른 값은 저장된다 — 저장 정책은 .claude/docs/file-lifecycle.md#설정-저장이 소유한다.

/** 알파 기본값이 갈리는 축. 테마 이름을 다시 정의하지 않으려고 기본값의 키를 쓴다. */
export type GlassTheme = keyof typeof GLASS_OPACITY_DEFAULT;

interface GlassState {
  /** 크롬 틴트의 알파. `null`은 아직 고르지 않아 테마의 기본값을 쓴다는 뜻이다. */
  opacity: number | null;
  /** 창 뒤 흐림 반경(px). */
  blurRadius: number;
  setOpacity: (opacity: number | null) => void;
  setBlurRadius: (radius: number) => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export const useGlassStore = create<GlassState>((set) => ({
  opacity: null,
  blurRadius: BLUR_RADIUS_DEFAULT,
  setOpacity: (opacity) => set({ opacity: opacity === null ? null : clamp(opacity, 0, 1) }),
  setBlurRadius: (radius) => set({ blurRadius: Math.round(clamp(radius, 0, BLUR_RADIUS_MAX)) }),
}));

/** 화면에 실제로 적용될 알파. 컨트롤은 이것만 보면 된다. */
export function resolveOpacity(opacity: number | null, theme: GlassTheme): number {
  return opacity ?? GLASS_OPACITY_DEFAULT[theme];
}
