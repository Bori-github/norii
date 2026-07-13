import { create } from "zustand";

// 테마 상태의 단일 소유자 — app 레이어가 갖는다(→ .claude/docs/design/design-system.md#테마-라이트다크).
//
// 3-상태인 이유: 사용자가 고른 값(light/dark)과 "OS를 따른다"(system)는 다른 것이다.
// system을 고른 사용자는 macOS 설정이 바뀌면 앱도 따라 바뀌길 기대한다 — 그 의도를 저장해야
// 재시작 후에도 지킬 수 있다. light/dark만 저장하면 그 의도가 사라진다.
//
// 지금 UI는 라이트↔다크 토글 하나뿐이지만, 설정 화면이 생기면 이 스토어에 세 번째 선택지를
// 그대로 노출한다 — 스토어를 다시 만들 필요가 없다.

/** 사용자의 의도. `system`은 "OS 설정을 따른다"이며, 그 자체가 하나의 선택이다. */
export type ThemePreference = "system" | "light" | "dark";

/** 화면에 실제로 적용되는 테마. 루트의 data-theme 속성이 이 값을 갖는다. */
export type ResolvedTheme = "light" | "dark";

/** OS 다크 모드 질의 — 스토어 초기값과 app 레이어의 변경 구독이 같은 문자열을 쓴다. */
export const DARK_QUERY = "(prefers-color-scheme: dark)";

interface ThemeState {
  preference: ThemePreference;
  /** OS가 현재 다크인가 — app 레이어가 matchMedia로 갱신한다. */
  systemPrefersDark: boolean;
  setPreference: (preference: ThemePreference) => void;
  setSystemPrefersDark: (prefersDark: boolean) => void;
}

/**
 * 스토어를 만드는 **그 순간** OS 설정을 읽는다 — 기본값 false로 시작해 이펙트에서 고치면,
 * 다크 사용자가 첫 프레임에 밝은 화면을 본다. matchMedia가 없는 환경(테스트)에서는 라이트로 본다.
 */
function systemPrefersDarkNow(): boolean {
  return typeof globalThis.matchMedia === "function" && globalThis.matchMedia(DARK_QUERY).matches;
}

export const useThemeStore = create<ThemeState>((set) => ({
  preference: "system",
  systemPrefersDark: systemPrefersDarkNow(),
  setPreference: (preference) => set({ preference }),
  setSystemPrefersDark: (systemPrefersDark) => set({ systemPrefersDark }),
}));

/** 의도 + OS 상태 → 실제 테마. 순수 함수라 테스트가 쉽고, 규칙이 한곳에 있다. */
export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === "system") {
    return systemPrefersDark ? "dark" : "light";
  }
  return preference;
}

/** 현재 화면에 적용될 테마. 컴포넌트는 이것만 보면 된다. */
export function useResolvedTheme(): ResolvedTheme {
  const preference = useThemeStore((state) => state.preference);
  const systemPrefersDark = useThemeStore((state) => state.systemPrefersDark);
  return resolveTheme(preference, systemPrefersDark);
}

/**
 * 토글 — 지금 보이는 테마의 반대로 **명시적으로 고정**한다.
 *
 * system 상태에서 토글하면 system을 벗어난다. 그게 사용자의 의도이기 때문이다:
 * "지금 화면이 밝은데 어둡게 하고 싶다"는 요청이지 "OS를 따르되 반대로"가 아니다.
 * system으로 돌아가는 길은 설정 화면이 열어 준다.
 */
export function toggleTheme(): void {
  const { preference, systemPrefersDark, setPreference } = useThemeStore.getState();
  const current = resolveTheme(preference, systemPrefersDark);
  setPreference(current === "dark" ? "light" : "dark");
}
