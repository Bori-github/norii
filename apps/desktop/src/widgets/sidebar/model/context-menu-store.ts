import { create } from "zustand";

import type { EntryKind } from "@features/manage-entries";

// 트리 항목의 컨텍스트 메뉴 상태 — 한 번에 하나만 열린다.

/** 우클릭한 항목. 빈 영역을 눌렀으면 없다 — 그때는 루트에 만들기만 뜬다. */
export interface EntryMenuTarget {
  path: string;
  name: string;
  kind: EntryKind;
}

export interface EntryMenu {
  target: EntryMenuTarget | null;
  /** 우클릭한 화면 좌표. */
  x: number;
  y: number;
}

interface ContextMenuState {
  menu: EntryMenu | null;
}

export const useContextMenuStore = create<ContextMenuState>(() => ({ menu: null }));

export function openEntryMenu(menu: EntryMenu): void {
  useContextMenuStore.setState({ menu });
}

export function closeEntryMenu(): void {
  useContextMenuStore.setState({ menu: null });
}
