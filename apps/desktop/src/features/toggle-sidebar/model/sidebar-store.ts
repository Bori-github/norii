import { create } from "zustand";

interface SidebarState {
  visible: boolean;
}

export const useSidebarStore = create<SidebarState>(() => ({
  visible: true,
}));

export function toggleSidebar(): void {
  useSidebarStore.setState((state) => ({ visible: !state.visible }));
}
