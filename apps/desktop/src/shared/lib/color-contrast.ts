// 색 대비 계산 — 디자인 토큰이 접근성 기준을 만족하는지 검사하는 데 쓴다.
// 유리(반투명 크롬) 뒤 바탕화면은 통제할 수 없지만, 틴트의 알파가 정해지면
// 합성 결과가 [순흑 위 · 순백 위] 구간에 갇힌다 → 양극단만 검사하면 모든 바탕화면이 커버된다.
// 기준의 단일 출처: .claude/docs/design/design-system.md#대비-게이트

export type Rgb = readonly [number, number, number];

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];

/** WCAG AA 본문 텍스트 최소 대비. */
export const AA_TEXT = 4.5;

/** `#rgb` · `#rrggbb` · `rgba(r, g, b, a)` 를 채널과 알파로 파싱한다. */
export function parseColor(value: string): { rgb: Rgb; alpha: number } {
  const rgba = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*(?:[,/]\s*([\d.]+)\s*)?\)$/.exec(value);
  const [, red, green, blue, alpha] = rgba ?? [];
  if (red !== undefined && green !== undefined && blue !== undefined) {
    return {
      rgb: [Number(red), Number(green), Number(blue)],
      alpha: alpha === undefined ? 1 : Number(alpha),
    };
  }

  const [, hex] = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value) ?? [];
  if (hex === undefined) {
    throw new Error(`색 형식을 해석할 수 없습니다: ${value}`);
  }
  // 3자리 hex(#fff)는 각 자리를 두 번 써서 6자리로 편다.
  const digits = hex.length === 3 ? [...hex].map((digit) => digit + digit).join("") : hex;
  const n = Number.parseInt(digits, 16);
  return { rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255], alpha: 1 };
}

/** sRGB 채널(0~255)을 감마 보정 해제해 선형 값으로 만든다. */
function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG 상대 휘도. */
export function relativeLuminance([r, g, b]: Rgb): number {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** 두 색의 대비비(1~21). 순서는 결과에 영향을 주지 않는다. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const luminanceA = relativeLuminance(a);
  const luminanceB = relativeLuminance(b);
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
}

/** 반투명 색을 불투명 배경 위에 합성한다(브라우저와 같은 sRGB 공간 합성). */
export function composite([r, g, b]: Rgb, alpha: number, [bgR, bgG, bgB]: Rgb): Rgb {
  const blend = (fg: number, bg: number): number => Math.round(fg * alpha + bg * (1 - alpha));
  return [blend(r, bgR), blend(g, bgG), blend(b, bgB)];
}

/**
 * 유리 표면이 놓일 수 있는 두 극단(가장 밝은 바탕화면 · 가장 어두운 바탕화면).
 * 실제 바탕화면이 무엇이든 합성 결과는 이 둘 사이에 있다.
 */
export function glassExtremes(tint: string): [Rgb, Rgb] {
  const { rgb, alpha } = parseColor(tint);
  return [composite(rgb, alpha, WHITE), composite(rgb, alpha, BLACK)];
}

/** 유리 위 글자가 임의의 바탕화면에서 기준을 만족하는가 — 두 극단 모두 통과해야 한다. */
export function contrastOnGlass(text: string, tint: string): { onWhite: number; onBlack: number } {
  const { rgb: textRgb } = parseColor(text);
  const [onWhite, onBlack] = glassExtremes(tint);
  return {
    onWhite: contrastRatio(textRgb, onWhite),
    onBlack: contrastRatio(textRgb, onBlack),
  };
}

/** 불투명 배경 위 글자의 대비. */
export function contrastOnSolid(text: string, background: string): number {
  const { rgb: textRgb, alpha: textAlpha } = parseColor(text);
  const { rgb: bgRgb } = parseColor(background);
  // 글자가 반투명이면 배경 위에 합성한 뒤 잰다.
  return contrastRatio(composite(textRgb, textAlpha, bgRgb), bgRgb);
}
