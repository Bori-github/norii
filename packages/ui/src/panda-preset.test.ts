import { describe, expect, it } from "vitest";

import { createNoriiPreset, GLASS_OPACITY_DEFAULT } from "./panda-preset";

const PRESET = createNoriiPreset({ glassOpacity: GLASS_OPACITY_DEFAULT });
const CONDITIONS = PRESET.conditions?.extend ?? {};
const COLORS = (PRESET.theme?.extend?.semanticTokens?.colors ?? {}) as Record<string, unknown>;

/** 값이 조건별 객체인 잎만 경로와 함께 모은다 */
function themedValues(node: unknown, path: string[] = []): [string, Record<string, string>][] {
  if (typeof node !== "object" || node === null) return [];
  const record = node as Record<string, unknown>;

  if ("value" in record) {
    const value = record["value"];
    if (typeof value !== "object" || value === null) return [];
    return [[path.join("."), value as Record<string, string>]];
  }

  return Object.entries(record).flatMap(([key, child]) => themedValues(child, [...path, key]));
}

const THEMED = themedValues(COLORS);

describe("테마 조건", () => {
  // 기본값으로만 두면 되돌릴 규칙이 없어 다크인 트리 안에서 하위만 라이트로 되돌릴 수 없다.
  it("라이트를 하위 트리에 걸 수 있다", () => {
    expect(CONDITIONS["light"]).toBe('[data-theme="light"] &');
  });

  // 유리는 캔버스를 투명으로 덮는데, specificity가 같아 뒤에 정의한 쪽이 이긴다.
  it("유리 조건이 테마 조건보다 뒤에 온다", () => {
    const order = Object.keys(CONDITIONS);
    expect(order.indexOf("glass")).toBeGreaterThan(order.indexOf("light"));
    expect(order.indexOf("glass")).toBeGreaterThan(order.indexOf("dark"));
  });
});

describe("모드로 갈리는 색", () => {
  it("다크 값이 있으면 라이트 값도 있다", () => {
    const missing = THEMED.filter(([, value]) => "_dark" in value && !("_light" in value)).map(
      ([token]) => token,
    );
    expect(missing).toEqual([]);
  });

  // 같은 값을 base와 _light 두 곳에 적으면 한쪽만 고쳤을 때 조용히 어긋난다.
  it("라이트 값이 기본값과 같다", () => {
    const drifted = THEMED.filter(
      ([, value]) => "_light" in value && value["_light"] !== value["base"],
    ).map(([token]) => token);
    expect(drifted).toEqual([]);
  });
});
