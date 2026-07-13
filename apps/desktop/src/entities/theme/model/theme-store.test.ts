import { beforeEach, describe, expect, it } from "vitest";

import { resolveTheme, toggleTheme, useThemeStore } from "./theme-store";

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

describe("toggleTheme", () => {
  it("보이는 테마의 반대로 고정한다 (라이트 → 다크)", () => {
    toggleTheme();
    expect(useThemeStore.getState().preference).toBe("dark");
  });

  it("system + OS 다크에서 토글하면 라이트로 고정된다 — 보이던 것의 반대다", () => {
    useThemeStore.setState({ preference: "system", systemPrefersDark: true });
    toggleTheme();
    expect(useThemeStore.getState().preference).toBe("light");
  });

  it("토글하면 system을 벗어난다 — 이후 OS가 바뀌어도 따라가지 않는다", () => {
    toggleTheme();
    useThemeStore.getState().setSystemPrefersDark(true);
    const { preference, systemPrefersDark } = useThemeStore.getState();
    expect(preference).toBe("dark");
    expect(resolveTheme(preference, systemPrefersDark)).toBe("dark");
  });

  it("두 번 토글하면 원래 보이던 테마로 돌아온다 (단, system은 아니다)", () => {
    toggleTheme();
    toggleTheme();
    expect(useThemeStore.getState().preference).toBe("light");
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
