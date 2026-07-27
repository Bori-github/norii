// 설정 저장의 이름들 — 저장 정책은 .claude/docs/file-lifecycle.md#설정-저장이 소유한다.

/** 저장 파일. `plugin-store`가 앱 config 디렉터리 아래에 만든다. */
export const SETTINGS_STORE_FILE = "settings.json";

export const SETTINGS_KEYS = {
  themePreference: "themePreference",
  glassOpacity: "glassOpacity",
  blurRadius: "blurRadius",
  viewMode: "viewMode",
  sidebarVisible: "sidebarVisible",
  autosaveIntervalMs: "autosaveIntervalMs",
} as const;

/** 저장 디바운스(ms) — 슬라이더를 끄는 동안 매 프레임 디스크에 쓰지 않는다. */
export const SETTINGS_SAVE_DEBOUNCE_MS = 300;

/** 읽기 상한(ms) - 정상 읽기보다 훨씬 길어 답이 오지 않을 때만 걸린다. */
export const SETTINGS_LOAD_TIMEOUT_MS = 1500;
