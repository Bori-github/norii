import { page } from "vitest/browser";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import "@app/index.css";

import { useGlassStore } from "@entities/glass";
import { useThemeStore } from "@entities/theme";
import { useAutosaveStore } from "@features/save-file";
import { BLUR_RADIUS_DEFAULT, GLASS_OPACITY_DEFAULT } from "@shared/config";

import { closeSettings, openSettings, useSettingsDialogStore } from "@features/toggle-settings";
import { SettingsDialog } from "./settings-dialog";

// 왜: 설정은 모달이라 열림/닫힘이 화면에서 실제로 갈려야 한다. jsdom은 <dialog>의 showModal을
//     구현하지 않아 이 갈림을 확인할 수 없다 — 그래서 실제 WebKit에서 본다.
// 보장: 열면 화면에 나타나고, 왼쪽 메뉴가 패널을 바꾸고, 고른 값이 스토어에 남고,
//       닫기 버튼이 화면에서 없앤다.
// 경계: 고른 테마가 실제 색으로 반영되는지는 여기서 보지 않는다 — 그건 루트 속성을 심는
//     app 레이어의 몫이다(→ .claude/docs/design/design-system.md#테마-라이트다크).

beforeEach(() => {
  useSettingsDialogStore.setState({ open: false });
  useThemeStore.setState({ preference: "system", systemPrefersDark: false });
  useGlassStore.setState({ opacity: null });
  // 모듈 전역 스토어라 초기화하지 않으면 한 테스트의 "끄기"가 뒤 테스트로 새어 나간다.
  useAutosaveStore.setState({ enabled: true });
});

afterEach(() => {
  closeSettings();
  cleanup();
});

describe("SettingsDialog", () => {
  it("닫혀 있으면 화면에 없다", () => {
    const { queryByTestId } = render(<SettingsDialog />);
    expect(queryByTestId("settings-dialog")).toBeNull();
  });

  it("열면 일반 패널이 보인다", async () => {
    const { getByTestId } = render(<SettingsDialog />);
    openSettings();

    await waitFor(() => {
      expect(getByTestId("settings-dialog")).not.toBeNull();
    });
    expect(getByTestId("settings-autosave-on").checkVisibility()).toBe(true);
    // 창 크기를 실제 앱에 가깝게 두고 찍는다 — 모달은 화면 크기에 비례해 자리를 잡는다.
    await page.viewport(1200, 800);
    await page.screenshot({ path: "__screenshots__/settings-dialog.png" });
  });

  it("불투명도 슬라이더는 아직 고르지 않았으면 그 테마의 기본값을 가리킨다", async () => {
    const { getByTestId } = render(<SettingsDialog />);
    openSettings();

    await waitFor(() => {
      expect(getByTestId("settings-opacity")).not.toBeNull();
    });
    const slider = getByTestId("settings-opacity") as HTMLInputElement;
    expect(Number(slider.value)).toBe(GLASS_OPACITY_DEFAULT.light);

    fireEvent.change(slider, { target: { value: "0.2" } });
    expect(useGlassStore.getState().opacity).toBe(0.2);
  });

  it("고른 테마가 스토어에 남는다", async () => {
    const { getByTestId } = render(<SettingsDialog />);
    openSettings();

    await waitFor(() => {
      expect(getByTestId("settings-theme-dark")).not.toBeNull();
    });
    fireEvent.click(getByTestId("settings-theme-dark"));
    expect(useThemeStore.getState().preference).toBe("dark");
  });

  it("외형을 고르면 외형 패널이 보인다", async () => {
    const { getByTestId } = render(<SettingsDialog />);
    openSettings();

    await waitFor(() => {
      expect(getByTestId("settings-nav-general")).not.toBeNull();
    });
    expect(getByTestId("settings-autosave-on").checkVisibility()).toBe(true);
    expect(getByTestId("settings-theme-system").checkVisibility()).toBe(false);

    fireEvent.click(getByTestId("settings-nav-appearance"));

    expect(getByTestId("settings-theme-system").checkVisibility()).toBe(true);
    expect(getByTestId("settings-autosave-on").checkVisibility()).toBe(false);
    await page.viewport(1200, 800);
    await page.screenshot({ path: "__screenshots__/settings-dialog-appearance.png" });
  });

  // 클릭으로 분류를 고르는 테스트는 방향키 이동이 깨져도 통과한다.
  it("방향키로 분류를 옮기고, Tab은 고른 칸에서만 멈춘다", async () => {
    const { getByTestId } = render(<SettingsDialog />);
    openSettings();

    await waitFor(() => {
      expect(getByTestId("settings-nav-general")).not.toBeNull();
    });
    const general = getByTestId("settings-nav-general");
    const appearance = getByTestId("settings-nav-appearance");
    expect(general.getAttribute("tabindex")).toBe("0");
    expect(appearance.getAttribute("tabindex")).toBe("-1");

    fireEvent.keyDown(general, { key: "ArrowDown" });

    expect(appearance.getAttribute("aria-selected")).toBe("true");
    expect(appearance.getAttribute("tabindex")).toBe("0");
    expect(document.activeElement).toBe(appearance);

    // 끝에서 한 번 더 누르면 처음으로 돈다.
    fireEvent.keyDown(appearance, { key: "ArrowDown" });
    expect(general.getAttribute("aria-selected")).toBe("true");
  });

  it("자동 저장을 끄면 그 선택이 스토어에 남는다", async () => {
    const { getByTestId } = render(<SettingsDialog />);
    openSettings();

    await waitFor(() => {
      expect(getByTestId("settings-nav-general")).not.toBeNull();
    });
    fireEvent.click(getByTestId("settings-nav-general"));
    fireEvent.click(getByTestId("settings-autosave-off"));

    expect(useAutosaveStore.getState().enabled).toBe(false);
    expect(getByTestId("settings-autosave-off").getAttribute("aria-pressed")).toBe("true");
  });

  it("기본값으로를 누르면 고른 값이 모두 기본값으로 돌아간다", async () => {
    const { getByTestId } = render(<SettingsDialog />);
    openSettings();

    await waitFor(() => {
      expect(getByTestId("settings-reset")).not.toBeNull();
    });
    fireEvent.click(getByTestId("settings-theme-dark"));
    fireEvent.change(getByTestId("settings-opacity"), { target: { value: "0.2" } });
    fireEvent.click(getByTestId("settings-nav-general"));
    fireEvent.click(getByTestId("settings-autosave-off"));
    fireEvent.click(getByTestId("settings-reset"));

    expect(useThemeStore.getState().preference).toBe("system");
    expect(useGlassStore.getState().opacity).toBeNull();
    expect(useGlassStore.getState().blurRadius).toBe(BLUR_RADIUS_DEFAULT);
    expect(useAutosaveStore.getState().enabled).toBe(true);
  });

  it("닫기 버튼을 누르면 화면에서 사라진다", async () => {
    const { getByTestId, queryByTestId } = render(<SettingsDialog />);
    openSettings();

    await waitFor(() => {
      expect(getByTestId("settings-close")).not.toBeNull();
    });
    fireEvent.click(getByTestId("settings-close"));

    await waitFor(() => {
      expect(queryByTestId("settings-dialog")).toBeNull();
    });
  });
});
