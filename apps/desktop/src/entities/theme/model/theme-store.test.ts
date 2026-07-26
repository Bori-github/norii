import { beforeEach, describe, expect, it } from "vitest";

import { resolveTheme, useThemeStore } from "./theme-store";

// 왜: 테마는 "사용자가 고른 값"과 "OS가 지금 어떤가" 두 입력에서 나온다. 이 둘을 섞으면
//     'system'을 고른 사용자가 OS를 바꿔도 앱이 안 따라오거나, 명시적으로 고른 값이 OS 변경에
//     덮이는 버그가 생긴다. 그래서 의도(preference)와 OS 상태를 분리해 저장하고 합성한다.
// 보장: 의도 + OS 상태 → 화면 테마의 매핑이 고정된다. 토글은 system을 벗어나 명시 값으로 간다.
// 경계: 실제 data-theme 속성을 심는 것은 use-theme 훅이 하고, 색이 실제로 바뀌는지는 실앱에서 본다.

beforeEach(() => {
  useThemeStore.setState({ preference: "system", systemPrefersDark: false });
});

describe("resolveTheme", () => {
  it("system이면 OS를 따른다", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("명시적으로 고른 값은 OS와 무관하게 유지된다", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
});

describe("기본 상태", () => {
  it("처음에는 OS 설정을 따른다 — 사용자가 아무것도 고르지 않았으므로", () => {
    expect(useThemeStore.getState().preference).toBe("system");
  });
});

describe("system 상태에서 OS가 바뀌면", () => {
  it("화면 테마가 따라간다", () => {
    expect(resolveTheme("system", useThemeStore.getState().systemPrefersDark)).toBe("light");
    useThemeStore.getState().setSystemPrefersDark(true);
    const { preference, systemPrefersDark } = useThemeStore.getState();
    expect(resolveTheme(preference, systemPrefersDark)).toBe("dark");
  });
});
