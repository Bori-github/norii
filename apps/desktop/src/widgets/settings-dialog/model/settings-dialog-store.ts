import { create } from "zustand";

/** 설정의 갈래. 지금은 하나이고, 늘어나면 왼쪽 목록의 항목이 는다. */
export type SettingsSection = "appearance";

interface SettingsDialogState {
  open: boolean;
  section: SettingsSection;
  setSection: (section: SettingsSection) => void;
}

export const useSettingsDialogStore = create<SettingsDialogState>((set) => ({
  open: false,
  section: "appearance",
  setSection: (section) => set({ section }),
}));

export function openSettings(): void {
  useSettingsDialogStore.setState({ open: true });
}

export function closeSettings(): void {
  useSettingsDialogStore.setState({ open: false });
}
