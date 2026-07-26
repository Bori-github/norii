import { create } from "zustand";

// 자동 저장 켜짐 여부 — 정책의 단일 출처: .claude/docs/file-lifecycle.md#자동-저장.

interface AutosaveState {
  enabled: boolean;
}

export const useAutosaveStore = create<AutosaveState>(() => ({ enabled: true }));

export function setAutosaveEnabled(enabled: boolean): void {
  useAutosaveStore.setState({ enabled });
}

export function isAutosaveEnabled(): boolean {
  return useAutosaveStore.getState().enabled;
}
