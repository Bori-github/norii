import { beforeEach, describe, expect, it } from "vitest";

import { BLUR_RADIUS_DEFAULT, BLUR_RADIUS_MAX, GLASS_OPACITY_DEFAULT } from "@shared/config";

import { resolveOpacity, useGlassStore } from "./glass-store";

// 왜: 크롬 알파의 기본값은 테마마다 다르다(대비 게이트의 계산 결과). 그래서 "아직 고르지 않음"과
//     "0을 골랐음"은 다른 상태이며, 하나로 뭉치면 고르지 않은 사용자가 다크에서도 라이트 기본값을
//     보거나 0을 고른 사용자의 선택이 기본값으로 되살아난다.
// 보장: 미설정 → 그 테마의 기본값, 설정 → 고른 값 그대로. 두 값 모두 범위 안으로 잘린다.
// 경계: 잘라낸 값이 화면에 어떻게 보이는지는 여기서 보지 않는다 — 적용은 app 레이어가 하고
//     흐림이 실제로 걸렸는지는 수동 검증 영역이다(→ design/window-chrome.md#검증).

beforeEach(() => {
  useGlassStore.setState({ opacity: null, blurRadius: BLUR_RADIUS_DEFAULT });
});

describe("resolveOpacity", () => {
  it("고르지 않았으면 그 테마의 기본값이다", () => {
    expect(resolveOpacity(null, "light")).toBe(GLASS_OPACITY_DEFAULT.light);
    expect(resolveOpacity(null, "dark")).toBe(GLASS_OPACITY_DEFAULT.dark);
  });

  it("고른 값은 테마와 무관하게 그대로다", () => {
    expect(resolveOpacity(0.3, "light")).toBe(0.3);
    expect(resolveOpacity(0.3, "dark")).toBe(0.3);
  });

  it("0을 고른 것은 고르지 않은 것과 다르다", () => {
    expect(resolveOpacity(0, "dark")).toBe(0);
  });
});

describe("setOpacity", () => {
  it("0~1 밖의 값은 양끝으로 잘린다", () => {
    useGlassStore.getState().setOpacity(1.4);
    expect(useGlassStore.getState().opacity).toBe(1);

    useGlassStore.getState().setOpacity(-0.2);
    expect(useGlassStore.getState().opacity).toBe(0);
  });

  it("null을 넣으면 기본값으로 되돌아간다", () => {
    useGlassStore.getState().setOpacity(0.4);
    useGlassStore.getState().setOpacity(null);
    expect(useGlassStore.getState().opacity).toBeNull();
  });
});

describe("setBlurRadius", () => {
  it("상한을 넘는 값은 상한으로 잘린다", () => {
    useGlassStore.getState().setBlurRadius(BLUR_RADIUS_MAX + 40);
    expect(useGlassStore.getState().blurRadius).toBe(BLUR_RADIUS_MAX);
  });

  it("음수는 0으로 잘린다 — 반경은 Rust에서 부호 없는 정수다", () => {
    useGlassStore.getState().setBlurRadius(-5);
    expect(useGlassStore.getState().blurRadius).toBe(0);
  });

  it("소수는 정수로 맞춘다 — 슬라이더가 중간값을 만들어도 반경은 px 정수다", () => {
    useGlassStore.getState().setBlurRadius(12.6);
    expect(useGlassStore.getState().blurRadius).toBe(13);
  });
});
