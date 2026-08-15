import { token } from "styled-system/tokens";

import { createNoriiPreset, GLASS_OPACITY_DEFAULT } from "../src/panda-preset";

// preset에서 읽기 때문에 색을 더하면 카탈로그에 그대로 나온다.
const THEME = createNoriiPreset({ glassOpacity: GLASS_OPACITY_DEFAULT }).theme?.extend;

/** 컴포넌트가 쓰는 색. 그룹 이름 → 리프 */
export const SEMANTIC = (THEME?.semanticTokens?.colors ?? {}) as Record<
  string,
  Record<string, unknown>
>;

/** 시맨틱 색이 참조하는 원본. 색 이름 → 단계 */
export const PRIMITIVE = (THEME?.tokens?.colors ?? {}) as Record<string, Record<string, unknown>>;

/** 시맨틱 색 그룹 하나와 두 모드에서의 값 */
export interface ColorGroup {
  readonly name: string;
  readonly tokens: string[];
  readonly light: Record<string, string>;
  readonly dark: Record<string, string>;
  /** 두 모드의 값이 하나라도 다른가 */
  readonly varies: boolean;
}

// DEFAULT 리프의 토큰 경로는 그룹 이름 자체다 — accent.DEFAULT → accent.
function leaves(group: string) {
  return Object.keys(SEMANTIC[group] ?? {}).map((leaf) =>
    leaf === "DEFAULT" ? group : `${group}.${leaf}`,
  );
}

function steps(name: string) {
  return Object.keys(PRIMITIVE[name] ?? {}).map((step) => `${name}.${step}`);
}

// 이름을 손으로 케밥으로 바꾸면 Panda 규칙과 어긋난 토큰이 빈 값으로 조용히 통과한다.
// 경로는 preset에서 만들기 때문에 codegen이 아는 이름인지는 실행할 때 알 수 있다.
function cssVar(path: string) {
  const variable = token.var(`colors.${path}` as Parameters<typeof token.var>[0]);
  if (!variable) throw new Error(`codegen에 없는 토큰: colors.${path}`);

  return variable.slice("var(".length, -1);
}

// 문서 페이지에는 데코레이터가 돌지 않아 루트 속성을 쓸 수 없다. 테마 조건이 `[data-theme="…"] &`라
// 잠깐 붙였다 떼는 요소에서도 값이 갈린다.
function readColors(tokens: string[], theme: "light" | "dark") {
  const host = document.createElement("div");
  host.dataset["theme"] = theme;
  host.style.cssText = "position:absolute;left:-9999px;top:0";
  document.body.appendChild(host);

  const style = getComputedStyle(host);
  const values = Object.fromEntries(
    tokens.map((path) => [path, style.getPropertyValue(cssVar(path)).trim()]),
  );

  host.remove();
  return values;
}

/**
 * 요소가 놓인 트리에서 색 토큰이 풀리는 값을 읽는다.
 *
 * @param host - 값을 잴 트리 안의 요소
 * @param path - 시맨틱 색 경로 (예: `bg.paper`)
 *
 * @returns `rgb(...)` 문자열 — `getComputedStyle`의 색과 같은 형식
 *
 * @description
 * 토큰 값을 테스트에 적으면 팔레트와 두 곳으로 갈리기 때문에 같은 트리에 빈 요소를 넣어 잰다
 */
export function resolvedColor(host: Element, path: string): string {
  const probe = document.createElement("div");
  probe.style.color = `var(${cssVar(path)})`;
  host.append(probe);

  const value = getComputedStyle(probe).color;
  probe.remove();

  return value;
}

/**
 * 시맨틱 색 그룹 하나를 읽는다.
 *
 * @param name - 그룹 이름
 *
 * @returns 그 그룹의 토큰 경로와 두 모드에서의 값
 *
 * @description
 * 순서를 가르는 쪽과 띠를 그리는 쪽이 따로 읽으면 판정이 어긋나기 때문에 한 번만 읽는다
 */
export function readGroup(name: string): ColorGroup {
  const tokens = leaves(name);
  const light = readColors(tokens, "light");
  const dark = readColors(tokens, "dark");

  return { name, tokens, light, dark, varies: tokens.some((t) => light[t] !== dark[t]) };
}

/**
 * 원시 색 한 갈래를 단계별로 읽는다.
 *
 * @param name - 원시 색 이름
 *
 * @returns `ColorItem`의 `colors`에 그대로 넘길 수 있는 단계 → 색값
 *
 * @description
 * 원시 색은 모드로 갈리지 않아 라이트만 읽는다
 */
export function readSteps(name: string) {
  return readColors(steps(name), "light");
}
