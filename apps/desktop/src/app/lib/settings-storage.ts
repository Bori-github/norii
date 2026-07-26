import { load } from "@tauri-apps/plugin-store";

import { useGlassStore } from "@entities/glass";
import { useThemeStore } from "@entities/theme";
import type { ThemePreference } from "@entities/theme";
import { setAutosaveEnabled, useAutosaveStore } from "@features/save-file";
import { setViewMode, useViewModeStore, VIEW_MODES } from "@features/switch-view-mode";
import type { ViewMode } from "@features/switch-view-mode";
import { setSidebarVisible, useSidebarStore } from "@features/toggle-sidebar";
import {
  SETTINGS_KEYS,
  SETTINGS_LOAD_TIMEOUT_MS,
  SETTINGS_SAVE_DEBOUNCE_MS,
  SETTINGS_STORE_FILE,
} from "@shared/config";
import { logger } from "@shared/lib";

/**
 * 저장된 설정을 읽어 스토어에 넣고, 이후 변화를 파일에 쓴다. 읽기·쓰기 실패는 삼킨다.
 * 저장 정책은 .claude/docs/file-lifecycle.md#설정-저장이 소유한다.
 */

type Store = Awaited<ReturnType<typeof load>>;

const THEME_PREFERENCES = new Set<ThemePreference>(["system", "light", "dark"]);
const VIEW_MODE_NAMES = new Set<string>(VIEW_MODES);

let store: Store | null = null;

async function openStore(): Promise<Store | null> {
  if (store) {
    return store;
  }
  try {
    store = await load(SETTINGS_STORE_FILE, { autoSave: false });
    return store;
  } catch {
    logger.warn("설정 저장소를 열지 못했습니다 — 기본값으로 계속합니다");
    return null;
  }
}

function asThemePreference(value: unknown): ThemePreference | null {
  return typeof value === "string" && THEME_PREFERENCES.has(value as ThemePreference)
    ? (value as ThemePreference)
    : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asViewMode(value: unknown): ViewMode | null {
  return typeof value === "string" && VIEW_MODE_NAMES.has(value) ? (value as ViewMode) : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

export async function loadSettings(): Promise<void> {
  const opened = await openStore();
  if (!opened) {
    return;
  }
  try {
    const [theme, opacity, blurRadius, viewMode, sidebarVisible, autosaveEnabled] =
      await Promise.all([
        opened.get(SETTINGS_KEYS.themePreference),
        opened.get(SETTINGS_KEYS.glassOpacity),
        opened.get(SETTINGS_KEYS.blurRadius),
        opened.get(SETTINGS_KEYS.viewMode),
        opened.get(SETTINGS_KEYS.sidebarVisible),
        opened.get(SETTINGS_KEYS.autosaveEnabled),
      ]);

    const preference = asThemePreference(theme);
    if (preference) {
      useThemeStore.getState().setPreference(preference);
    }
    // 범위 자르기는 스토어가 이미 한다 — 여기서 두 번째 규칙을 만들지 않는다.
    const storedOpacity = asNumber(opacity);
    if (storedOpacity !== null) {
      useGlassStore.getState().setOpacity(storedOpacity);
    }
    const storedRadius = asNumber(blurRadius);
    if (storedRadius !== null) {
      useGlassStore.getState().setBlurRadius(storedRadius);
    }
    const mode = asViewMode(viewMode);
    if (mode) {
      setViewMode(mode);
    }
    const sidebar = asBoolean(sidebarVisible);
    if (sidebar !== null) {
      setSidebarVisible(sidebar);
    }
    const autosave = asBoolean(autosaveEnabled);
    if (autosave !== null) {
      setAutosaveEnabled(autosave);
    }
  } catch {
    logger.warn("설정을 읽지 못했습니다 — 기본값으로 계속합니다");
  }
}

/** 저장값을 읽되 상한 안에 돌아온다(→ .claude/docs/design/window-chrome.md#부팅-순서--창은-언제-보이는가). */
export async function loadSettingsWithin(timeoutMs = SETTINGS_LOAD_TIMEOUT_MS): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    loadSettings(),
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, timeoutMs);
    }),
  ]);
  clearTimeout(timer);
}

function snapshot(): string {
  const { preference } = useThemeStore.getState();
  const { opacity, blurRadius } = useGlassStore.getState();
  const { mode } = useViewModeStore.getState();
  const { visible } = useSidebarStore.getState();
  const { enabled } = useAutosaveStore.getState();
  return JSON.stringify([preference, opacity, blurRadius, mode, visible, enabled]);
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
// 두 스토어에는 저장하지 않는 값도 있다(OS가 지금 다크인가) — 저장 대상만 비교한다.
let written = "";

async function save(): Promise<void> {
  const pending = snapshot();
  if (pending === written) {
    return;
  }
  const opened = await openStore();
  if (!opened) {
    return;
  }
  const { preference } = useThemeStore.getState();
  const { opacity, blurRadius } = useGlassStore.getState();
  const { mode } = useViewModeStore.getState();
  const { visible } = useSidebarStore.getState();
  const { enabled } = useAutosaveStore.getState();
  try {
    await opened.set(SETTINGS_KEYS.themePreference, preference);
    await opened.set(SETTINGS_KEYS.glassOpacity, opacity);
    await opened.set(SETTINGS_KEYS.blurRadius, blurRadius);
    await opened.set(SETTINGS_KEYS.viewMode, mode);
    await opened.set(SETTINGS_KEYS.sidebarVisible, visible);
    await opened.set(SETTINGS_KEYS.autosaveEnabled, enabled);
    await opened.save();
    written = pending;
  } catch {
    logger.warn("설정을 저장하지 못했습니다");
  }
}

function scheduleSave(): void {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void save();
  }, SETTINGS_SAVE_DEBOUNCE_MS);
}

/** 값이 바뀔 때 저장한다. 반환값을 부르면 구독을 끊는다. */
export function persistSettingsOnChange(): () => void {
  written = snapshot();

  const unsubscribe = [
    useThemeStore.subscribe(scheduleSave),
    useGlassStore.subscribe(scheduleSave),
    useViewModeStore.subscribe(scheduleSave),
    useSidebarStore.subscribe(scheduleSave),
    useAutosaveStore.subscribe(scheduleSave),
  ];

  return () => {
    if (saveTimer !== null) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    for (const stop of unsubscribe) {
      stop();
    }
  };
}

/** 대기 중인 저장을 지금 쓴다(→ .claude/docs/file-lifecycle.md#설정-저장). */
export async function flushSettings(): Promise<void> {
  if (saveTimer === null) {
    return;
  }
  clearTimeout(saveTimer);
  saveTimer = null;
  await save();
}
