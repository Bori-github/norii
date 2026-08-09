import { create } from "zustand";

// 접힘은 영속화하지 않는다(→ document-model.md#최근-파일).

interface RecentSectionState {
  collapsed: boolean;
}

export const useRecentSectionStore = create<RecentSectionState>()(() => ({ collapsed: false }));

export function toggleRecentSection(): void {
  useRecentSectionStore.setState((state) => ({ collapsed: !state.collapsed }));
}
