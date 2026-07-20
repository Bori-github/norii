import { create } from "zustand";

// 탭별 "디스크에서 삭제됨" 상태 — file-removed 이벤트가 켜고, 명시적 저장(새로 생성)이나
// 외부 재생성이 끈다. 켜져 있는 동안 자동 저장은 멈춘다(→ file-lifecycle.md#외부-변경-처리).

interface MissingFileState {
  /** 파일이 디스크에서 사라진 탭 id 집합. */
  missingTabIds: string[];
  markMissing(tabId: string): void;
  clearMissing(tabId: string): void;
}

export const useMissingFileStore = create<MissingFileState>()((set) => ({
  missingTabIds: [],
  markMissing(tabId) {
    set((state) => ({
      missingTabIds: state.missingTabIds.includes(tabId)
        ? state.missingTabIds
        : [...state.missingTabIds, tabId],
    }));
  },
  clearMissing(tabId) {
    set((state) => ({ missingTabIds: state.missingTabIds.filter((id) => id !== tabId) }));
  },
}));

export function isTabFileMissing(tabId: string): boolean {
  return useMissingFileStore.getState().missingTabIds.includes(tabId);
}
