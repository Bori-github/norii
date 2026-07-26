import { beforeEach, describe, expect, it } from "vitest";

import { closeSettings, openSettings, useSettingsDialogStore } from "./settings-dialog-store";

// 왜: 설정은 여러 갈래(단축키·버튼)로 열리고 여러 갈래(Esc·닫기 버튼)로 닫힌다. 열림 여부와
//     보고 있는 갈래를 한 곳이 갖지 않으면, 닫았다 다시 열 때 이전에 보던 갈래가 사라진다.
// 보장: 기본은 닫힘이고, 다시 열면 마지막에 보던 갈래가 그대로다.
// 경계: 갈래에 무엇이 들어가는지는 여기서 모른다 — 화면 조합은 ui가 한다.

beforeEach(() => {
  useSettingsDialogStore.setState({ open: false, section: "appearance" });
});

describe("settings-dialog-store", () => {
  it("기본은 닫힘이다", () => {
    expect(useSettingsDialogStore.getState().open).toBe(false);
  });

  it("열고 닫는다", () => {
    openSettings();
    expect(useSettingsDialogStore.getState().open).toBe(true);

    closeSettings();
    expect(useSettingsDialogStore.getState().open).toBe(false);
  });

  it("닫았다 열어도 보던 갈래는 그대로다", () => {
    openSettings();
    useSettingsDialogStore.getState().setSection("appearance");
    closeSettings();
    openSettings();
    expect(useSettingsDialogStore.getState().section).toBe("appearance");
  });
});
