import { create } from "zustand";

import { AUTOSAVE_INTERVAL_DEFAULT_MS, type AutosaveInterval } from "../config";

// 자동 저장 간격 — 정책의 단일 출처: .claude/docs/file-lifecycle.md#자동-저장.

interface AutosaveState {
  intervalMs: AutosaveInterval;
}

export const useAutosaveStore = create<AutosaveState>(() => ({
  intervalMs: AUTOSAVE_INTERVAL_DEFAULT_MS,
}));

export function setAutosaveInterval(intervalMs: AutosaveInterval): void {
  useAutosaveStore.setState({ intervalMs });
}

export function autosaveIntervalMs(): AutosaveInterval {
  return useAutosaveStore.getState().intervalMs;
}

export function isAutosaveEnabled(): boolean {
  return autosaveIntervalMs() !== null;
}
