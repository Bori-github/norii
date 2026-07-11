import { create } from "zustand";

// 탭별 충돌 상태 — 충돌 중에는 자동 저장이 일시 중지되고(→ file-lifecycle.md#자동-저장),
// 사용자가 디스크/편집 버전을 명시적으로 선택할 때까지 유지된다(자동 병합 금지).

interface ConflictState {
  /** 충돌 중인 탭 id 집합. */
  conflictTabIds: string[];
  markConflict(tabId: string): void;
  clearConflict(tabId: string): void;
}

export const useConflictStore = create<ConflictState>()((set) => ({
  conflictTabIds: [],
  markConflict(tabId) {
    set((state) => ({
      conflictTabIds: state.conflictTabIds.includes(tabId)
        ? state.conflictTabIds
        : [...state.conflictTabIds, tabId],
    }));
  },
  clearConflict(tabId) {
    set((state) => ({ conflictTabIds: state.conflictTabIds.filter((id) => id !== tabId) }));
  },
}));

export function isTabInConflict(tabId: string): boolean {
  return useConflictStore.getState().conflictTabIds.includes(tabId);
}
