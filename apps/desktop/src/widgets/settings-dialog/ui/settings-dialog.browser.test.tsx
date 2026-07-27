import { page } from "vitest/browser";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import "@app/index.css";

import { useGlassStore } from "@entities/glass";
import { useThemeStore } from "@entities/theme";
import {
  AUTOSAVE_INTERVAL_DEFAULT_MS,
  AUTOSAVE_INTERVALS_MS,
  useAutosaveStore,
} from "@features/save-file";
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
  useAutosaveStore.setState({ intervalMs: AUTOSAVE_INTERVAL_DEFAULT_MS });
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
    expect(getByTestId("settings-autosave").checkVisibility()).toBe(true);
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
    expect(getByTestId("settings-autosave").checkVisibility()).toBe(true);
    expect(getByTestId("settings-theme-system").checkVisibility()).toBe(false);

    fireEvent.click(getByTestId("settings-nav-appearance"));

    expect(getByTestId("settings-theme-system").checkVisibility()).toBe(true);
    expect(getByTestId("settings-autosave").checkVisibility()).toBe(false);
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

  // 집행: file-lifecycle.md#자동-저장 — 고를 수 있는 값은 config.ts가 소유한다.
  // 왜: 화면이 값 목록을 따로 적으면 config에 간격을 더해도 select에 나타나지 않고, 저장 파일
  //     검사만 그 값을 유효로 받아 화면에 없는 설정이 존재하게 된다.
  // 경계: 라벨 문구는 보지 않는다 — 값에서 만들어지므로 문구는 strings가 소유한다.
  it("고를 수 있는 간격은 설정 목록과 같다", async () => {
    const { getByTestId } = render(<SettingsDialog />);
    openSettings();

    await waitFor(() => {
      expect(getByTestId("settings-autosave")).not.toBeNull();
    });
    const select = getByTestId("settings-autosave") as HTMLSelectElement;
    const shown = [...select.options].map((option) => option.value);

    expect(shown).toEqual(
      AUTOSAVE_INTERVALS_MS.map((interval) =>
        interval === null ? "off" : `${String(interval / 1000)}s`,
      ),
    );
  });

  // 왜: 고른 항목과 스토어 값이 어긋나면 사용자는 자기가 고른 간격이 무엇인지 화면에서 알 수 없다.
  // 경계: 목록에 무엇이 있는지는 config.ts가 정한다 — 여기선 고르기가 값에 닿는지만 본다.
  it("고른 간격이 스토어에 남고 그 항목이 선택된 채로 있다", async () => {
    const { getByTestId } = render(<SettingsDialog />);
    openSettings();

    await waitFor(() => {
      expect(getByTestId("settings-nav-general")).not.toBeNull();
    });
    const select = getByTestId("settings-autosave") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "30s" } });

    expect(useAutosaveStore.getState().intervalMs).toBe(30_000);
    expect(select.value).toBe("30s");
  });

  // 왜: 설명이 고른 값을 따라가지 않으면 5초를 골라 놓고 "1분마다"를 읽게 된다. 끄기는 저장
  //     방법 자체가 바뀌므로(⌘S) 그 문장이 나오지 않으면 저장할 방법을 화면에서 알 수 없다.
  it("설명이 고른 값을 따라가고, 끄기면 수동 저장을 알린다", async () => {
    const { getByTestId, getByText, queryByText } = render(<SettingsDialog />);
    openSettings();

    await waitFor(() => {
      expect(getByTestId("settings-autosave")).not.toBeNull();
    });
    expect(getByText("5초마다 문서를 자동으로 저장합니다.")).not.toBeNull();

    fireEvent.change(getByTestId("settings-autosave"), { target: { value: "60s" } });
    expect(getByText("1분마다 문서를 자동으로 저장합니다.")).not.toBeNull();

    fireEvent.change(getByTestId("settings-autosave"), { target: { value: "off" } });

    expect(useAutosaveStore.getState().intervalMs).toBeNull();
    expect(getByText("자동 저장이 꺼져 있습니다. ⌘S로 직접 저장하세요.")).not.toBeNull();
    expect(queryByText("1분마다 문서를 자동으로 저장합니다.")).toBeNull();
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
    fireEvent.change(getByTestId("settings-autosave"), { target: { value: "off" } });
    fireEvent.click(getByTestId("settings-reset"));

    expect(useThemeStore.getState().preference).toBe("system");
    expect(useGlassStore.getState().opacity).toBeNull();
    expect(useGlassStore.getState().blurRadius).toBe(BLUR_RADIUS_DEFAULT);
    expect(useAutosaveStore.getState().intervalMs).toBe(AUTOSAVE_INTERVAL_DEFAULT_MS);
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
