import { create } from "zustand";

export type ViewMode = "editor" | "split" | "preview";

interface ViewModeState {
  mode: ViewMode;
}

export const useViewModeStore = create<ViewModeState>(() => ({
  mode: "split",
}));

export function setViewMode(mode: ViewMode): void {
  useViewModeStore.setState({ mode });
}
