// 플랫폼 분기 — 단축키의 mac ⌘ / Windows·Linux Ctrl 매핑에 쓴다
// (→ .claude/docs/editor-strategy.md#단축키-계약).
export const isMac: boolean =
  typeof navigator !== "undefined" && navigator.userAgent.includes("Mac");

/** 단축키 계약의 주 수정자(mac은 Cmd, 그 외 Ctrl)가 눌렸는지. */
export function isPrimaryModifier(event: KeyboardEvent): boolean {
  return isMac ? event.metaKey : event.ctrlKey;
}

/**
 * 창 유리(macOS vibrancy)가 켜져 있는가.
 *
 * "macOS인가"와 다른 명제다 — 유리를 끄면 macOS에서도 불투명 캔버스여야 하고, 그때 이 값은
 * false다. 지금은 창 설정(tauri.conf.json)이 macOS에서만 유리를 켜므로 플랫폼 판정과 일치하지만,
 * 의미가 다른 두 명제를 한 이름으로 묶지 않는다(→ .claude/docs/design/window-chrome.md).
 */
export const hasWindowGlass: boolean = isMac;
