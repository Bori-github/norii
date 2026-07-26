import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { load, storeGet, storeSet, storeSave } = vi.hoisted(() => {
  const get = vi.fn();
  const set = vi.fn(async () => {});
  const save = vi.fn(async () => {});
  return {
    storeGet: get,
    storeSet: set,
    storeSave: save,
    load: vi.fn(async () => ({ get, set, save })),
  };
});
vi.mock("@tauri-apps/plugin-store", () => ({ load }));
vi.mock("@tauri-apps/plugin-log", () => ({
  error: vi.fn(async () => {}),
  warn: vi.fn(async () => {}),
  info: vi.fn(async () => {}),
}));

import { useGlassStore } from "@entities/glass";
import { useThemeStore } from "@entities/theme";
import { setViewMode, useViewModeStore } from "@features/switch-view-mode";
import { setSidebarVisible, useSidebarStore } from "@features/toggle-sidebar";
import {
  BLUR_RADIUS_DEFAULT,
  SETTINGS_LOAD_TIMEOUT_MS,
  SETTINGS_SAVE_DEBOUNCE_MS,
} from "@shared/config";

import {
  flushSettings,
  loadSettings,
  loadSettingsWithin,
  persistSettingsOnChange,
} from "./settings-storage";

// 왜: 저장값은 사용자가 손으로 고칠 수 있는 파일에서 온다. 그대로 믿고 스토어에 넣으면 이상한
//     값 하나가 화면을 깨뜨리고, 기동 실패로도 이어진다. 반대로 저장이 실패했다고 창을 못 띄우면
//     설정 하나 때문에 앱을 잃는다.
// 보장: 아는 값만 받아들이고, 읽기가 어떤 이유로 실패해도 기본값으로 계속 간다.
//     쓰기는 값이 바뀔 때 디바운스로 한 번만 나간다.
// 경계: 첫 프레임에 그 값이 반영되는지와 창이 언제 보이는지는 부팅 순서의 몫이다
//     (→ .claude/docs/design/window-chrome.md#부팅-순서--창은-언제-보이는가).

beforeEach(() => {
  vi.clearAllMocks();
  storeGet.mockReset();
  useThemeStore.setState({ preference: "system" });
  useGlassStore.setState({ opacity: null, blurRadius: BLUR_RADIUS_DEFAULT });
  useViewModeStore.setState({ mode: "split" });
  useSidebarStore.setState({ visible: true });
});

afterEach(() => {
  vi.useRealTimers();
});

function stored(values: Record<string, unknown>): void {
  storeGet.mockImplementation(async (key: string) => values[key]);
}

describe("loadSettings", () => {
  it("저장된 값을 스토어에 넣는다", async () => {
    stored({
      themePreference: "dark",
      glassOpacity: 0.3,
      blurRadius: 12,
      viewMode: "preview",
      sidebarVisible: false,
    });
    await loadSettings();

    expect(useThemeStore.getState().preference).toBe("dark");
    expect(useGlassStore.getState().opacity).toBe(0.3);
    expect(useGlassStore.getState().blurRadius).toBe(12);
    expect(useViewModeStore.getState().mode).toBe("preview");
    expect(useSidebarStore.getState().visible).toBe(false);
  });

  it("모르는 값은 무시하고 기본값을 지킨다", async () => {
    stored({
      themePreference: "sepia",
      glassOpacity: "밝게",
      blurRadius: null,
      viewMode: "zen",
      sidebarVisible: "접힘",
    });
    await loadSettings();

    expect(useThemeStore.getState().preference).toBe("system");
    expect(useGlassStore.getState().opacity).toBeNull();
    expect(useGlassStore.getState().blurRadius).toBe(BLUR_RADIUS_DEFAULT);
    expect(useViewModeStore.getState().mode).toBe("split");
    expect(useSidebarStore.getState().visible).toBe(true);
  });

  it("읽기가 실패해도 기본값으로 계속 간다", async () => {
    load.mockRejectedValueOnce(new Error("파일을 열 수 없습니다"));
    await expect(loadSettings()).resolves.toBeUndefined();
    expect(useThemeStore.getState().preference).toBe("system");
  });

  it("범위 밖 숫자는 스토어가 자른 값으로 들어온다", async () => {
    stored({ glassOpacity: 5, blurRadius: 9999 });
    await loadSettings();

    expect(useGlassStore.getState().opacity).toBe(1);
    expect(useGlassStore.getState().blurRadius).toBe(100);
  });
});

describe("persistSettingsOnChange", () => {
  it("값이 바뀌면 디바운스 뒤 한 번 저장한다", async () => {
    vi.useFakeTimers();
    stored({});
    await loadSettings();
    const stop = persistSettingsOnChange();

    useGlassStore.getState().setBlurRadius(10);
    useGlassStore.getState().setBlurRadius(20);
    expect(storeSave).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(SETTINGS_SAVE_DEBOUNCE_MS);
    expect(storeSave).toHaveBeenCalledTimes(1);
    expect(storeSet).toHaveBeenCalledWith("blurRadius", 20);
    stop();
  });

  it("뷰 모드와 사이드바 접힘도 함께 쓴다", async () => {
    vi.useFakeTimers();
    stored({});
    await loadSettings();
    const stop = persistSettingsOnChange();

    setViewMode("editor");
    setSidebarVisible(false);

    await vi.advanceTimersByTimeAsync(SETTINGS_SAVE_DEBOUNCE_MS);
    expect(storeSet).toHaveBeenCalledWith("viewMode", "editor");
    expect(storeSet).toHaveBeenCalledWith("sidebarVisible", false);
    stop();
  });

  it("저장 대상이 그대로면 쓰지 않는다 — OS 테마가 바뀌어도 파일은 그대로다", async () => {
    vi.useFakeTimers();
    stored({});
    await loadSettings();
    const stop = persistSettingsOnChange();

    useThemeStore.getState().setSystemPrefersDark(true);
    await vi.advanceTimersByTimeAsync(SETTINGS_SAVE_DEBOUNCE_MS);
    expect(storeSave).not.toHaveBeenCalled();
    stop();
  });

  it("구독을 끊으면 더 이상 저장하지 않는다", async () => {
    vi.useFakeTimers();
    stored({});
    await loadSettings();
    const stop = persistSettingsOnChange();
    stop();

    useThemeStore.getState().setPreference("light");
    await vi.advanceTimersByTimeAsync(SETTINGS_SAVE_DEBOUNCE_MS);
    expect(storeSave).not.toHaveBeenCalled();
  });
});

describe("loadSettingsWithin", () => {
  it("읽기가 끝나지 않아도 상한에서 돌아온다", async () => {
    vi.useFakeTimers();
    load.mockReturnValueOnce(new Promise(() => {}));

    const pending = loadSettingsWithin();
    await vi.advanceTimersByTimeAsync(SETTINGS_LOAD_TIMEOUT_MS);

    await expect(pending).resolves.toBeUndefined();
  });
});

describe("flushSettings", () => {
  it("디바운스가 남아 있으면 지금 쓴다 — 창을 닫아도 마지막 조절이 남는다", async () => {
    vi.useFakeTimers();
    stored({});
    await loadSettings();
    const stop = persistSettingsOnChange();

    useGlassStore.getState().setBlurRadius(44);

    await flushSettings();
    expect(storeSave).toHaveBeenCalledTimes(1);
    expect(storeSet).toHaveBeenCalledWith("blurRadius", 44);
    stop();
  });

  it("쓸 것이 없으면 아무 일도 하지 않는다", async () => {
    stored({});
    await loadSettings();
    const stop = persistSettingsOnChange();

    await flushSettings();
    expect(storeSave).not.toHaveBeenCalled();
    stop();
  });
});
