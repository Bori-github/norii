import { create } from "zustand";

import type { CursorPosition } from "@norii/editor";

// 에디터 → 상태바의 중계소 — 두 위젯은 같은 레이어라 서로 직접 참조할 수 없다(FSD).

interface EditorStatusState {
  cursor: CursorPosition | null;
  chars: number | null;
}

export const useEditorStatusStore = create<EditorStatusState>(() => ({
  cursor: null,
  chars: null,
}));

export function reportCursor(cursor: CursorPosition): void {
  useEditorStatusStore.setState({ cursor });
}

export function reportChars(chars: number): void {
  useEditorStatusStore.setState({ chars });
}

export function clearChars(): void {
  useEditorStatusStore.setState({ chars: null });
}

export function clearEditorStatus(): void {
  useEditorStatusStore.setState({ cursor: null, chars: null });
}
