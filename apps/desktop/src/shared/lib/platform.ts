// 플랫폼 분기 — 단축키의 mac ⌘ / Windows·Linux Ctrl 매핑에 쓴다
// (→ .claude/docs/editor-strategy.md#단축키-계약).
export const isMac: boolean =
  typeof navigator !== "undefined" && navigator.userAgent.includes("Mac");

/** 단축키 계약의 주 수정자(mac은 Cmd, 그 외 Ctrl)가 눌렸는지. */
export function isPrimaryModifier(event: KeyboardEvent): boolean {
  return isMac ? event.metaKey : event.ctrlKey;
}
