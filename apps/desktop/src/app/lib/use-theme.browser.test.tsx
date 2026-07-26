import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { setTheme } = vi.hoisted(() => ({ setTheme: vi.fn(async () => {}) }));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: () => ({ setTheme }) }));
vi.mock("@tauri-apps/plugin-log", () => ({
  error: vi.fn(async () => {}),
  warn: vi.fn(async () => {}),
  info: vi.fn(async () => {}),
}));

import { useThemeStore } from "@entities/theme";

import { useTheme } from "./use-theme";

// 왜: 창에 테마를 못 박으면 웹뷰가 OS에 묻는 값(prefers-color-scheme)이 그 값으로 뒤집힌다(실측).
//     그러면 다크를 한 번 고른 사용자가 다시 "시스템"을 골라도 앱은 다크에 갇힌다 — 못 박힌 값이
//     OS 값 행세를 하기 때문이다.
// 보장: `system`일 때는 창에 테마를 넘기지 않아 창이 OS를 계속 따른다.
// 경계: 창이 실제로 OS를 따라 돌아오는지는 OS 합성기 영역이라 실앱에서 눈으로 본다
//     (→ .claude/docs/design/window-chrome.md#검증).

beforeEach(() => {
  setTheme.mockClear();
  useThemeStore.setState({ preference: "system", systemPrefersDark: false });
});

afterEach(cleanup);

describe("useTheme — 창 테마 동기화", () => {
  it("system이면 창에 테마를 못 박지 않는다", () => {
    renderHook(() => useTheme());
    expect(setTheme).toHaveBeenCalledWith(null);
  });

  it("명시적으로 고른 테마는 창에도 그대로 넘긴다", () => {
    useThemeStore.setState({ preference: "dark" });
    renderHook(() => useTheme());
    expect(setTheme).toHaveBeenCalledWith("dark");
  });

  it("고른 테마에서 system으로 돌아오면 창의 고정을 푼다", () => {
    useThemeStore.setState({ preference: "dark" });
    const { rerender } = renderHook(() => useTheme());
    setTheme.mockClear();

    useThemeStore.setState({ preference: "system" });
    rerender();
    expect(setTheme).toHaveBeenCalledWith(null);
  });
});
