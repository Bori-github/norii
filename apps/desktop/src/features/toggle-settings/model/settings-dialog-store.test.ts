import { beforeEach, describe, expect, it } from "vitest";

import { closeSettings, openSettings, useSettingsDialogStore } from "./settings-dialog-store";

// 왜: 설정은 여러 갈래(단축키·버튼)로 열리고 여러 갈래(Esc·닫기 버튼)로 닫힌다. 열림 여부를
//     한 곳이 갖지 않으면 어느 경로로 닫았는지에 따라 화면이 갈린다.
// 보장: 기본은 닫힘이고, 두 함수가 그 값만 바꾼다.
// 경계: 화면에 실제로 서는지는 여기서 보지 않는다 — ui의 브라우저 테스트가 본다.

beforeEach(() => {
  useSettingsDialogStore.setState({ open: false });
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
});
