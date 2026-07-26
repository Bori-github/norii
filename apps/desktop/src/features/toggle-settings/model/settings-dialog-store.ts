import { create } from "zustand";

interface SettingsDialogState {
  open: boolean;
}

export const useSettingsDialogStore = create<SettingsDialogState>(() => ({ open: false }));

export function openSettings(): void {
  useSettingsDialogStore.setState({ open: true });
}

export function closeSettings(): void {
  useSettingsDialogStore.setState({ open: false });
}
