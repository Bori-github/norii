import { create } from "zustand";

/** 뷰 모드 이름 — 저장값 검증(→ app/lib/settings-storage)도 이 목록을 쓴다. */
export const VIEW_MODES = ["editor", "split", "preview"] as const;

export type ViewMode = (typeof VIEW_MODES)[number];

interface ViewModeState {
  mode: ViewMode;
}

export const useViewModeStore = create<ViewModeState>(() => ({
  mode: "split",
}));

export function setViewMode(mode: ViewMode): void {
  useViewModeStore.setState({ mode });
}
