import { page } from "vitest/browser";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import "@app/index.css";

import { useGlassStore } from "@entities/glass";
import { useThemeStore } from "@entities/theme";
import { GLASS_OPACITY_DEFAULT } from "@shared/config";

import { closeSettings, openSettings, useSettingsDialogStore } from "@features/toggle-settings";
import { SettingsDialog } from "./settings-dialog";

// 왜: 설정은 모달이라 열림/닫힘이 화면에서 실제로 갈려야 한다. jsdom은 <dialog>의 showModal을
//     구현하지 않아 이 갈림을 확인할 수 없다 — 그래서 실제 WebKit에서 본다.
// 보장: 열면 화면에 서고, 테마를 고르면 그 선택이 스토어에 남고, 닫기 버튼이 화면에서 지운다.
// 경계: 고른 테마가 실제 색으로 반영되는지는 여기서 보지 않는다 — 그건 루트 속성을 심는
//     app 레이어의 몫이다(→ .claude/docs/design/design-system.md#테마-라이트다크).

beforeEach(() => {
  useSettingsDialogStore.setState({ open: false, section: "appearance" });
  useThemeStore.setState({ preference: "system", systemPrefersDark: false });
  useGlassStore.setState({ opacity: null });
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

  it("열면 외형 갈래가 선 채로 뜬다", async () => {
    const { getByTestId } = render(<SettingsDialog />);
    openSettings();

    await waitFor(() => {
      expect(getByTestId("settings-dialog")).not.toBeNull();
    });
    expect(getByTestId("settings-theme")).not.toBeNull();
    // 창 크기를 실제 앱에 가깝게 두고 찍는다 — 모달은 화면 크기에 비례해 자리를 잡는다.
    await page.viewport(1200, 800);
    await page.screenshot({ path: "__screenshots__/settings-dialog.png" });
  });

  it("불투명도 슬라이더는 아직 고르지 않았으면 그 테마의 기본값에 선다", async () => {
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
      expect(getByTestId("settings-theme")).not.toBeNull();
    });
    fireEvent.change(getByTestId("settings-theme"), { target: { value: "dark" } });
    expect(useThemeStore.getState().preference).toBe("dark");
  });

  it("닫기 버튼이 화면에서 지운다", async () => {
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
