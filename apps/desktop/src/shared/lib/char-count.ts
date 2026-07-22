// 계산 규칙의 근거는 char-count.test.ts가 소유한다.

const graphemes = new Intl.Segmenter("ko", { granularity: "grapheme" });

export function countChars(text: string): number {
  let chars = 0;
  for (const _ of graphemes.segment(text)) {
    chars += 1;
  }
  return chars;
}
