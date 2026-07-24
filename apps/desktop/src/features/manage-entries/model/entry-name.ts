import { STRINGS } from "@shared/config";

// 항목 이름 판정 — 규칙의 단일 출처는 .claude/docs/rust-commands.md#항목-이름-규칙.

/** 인라인 경고 문구를 고르는 데 쓰는 문제 종류. */
export type EntryProblem = "empty" | "hidden" | "invalid" | "duplicate" | "failed";

export type EntryKind = "file" | "dir";

function hasControlChar(name: string): boolean {
  return [...name].some((char) => {
    const code = char.codePointAt(0) ?? 0;
    return code < 0x20 || code === 0x7f;
  });
}

export function withMarkdownExtension(name: string): string {
  return /\.(md|markdown)$/i.test(name) ? name : `${name}.md`;
}

/** 만들어질 최종 이름 — 파일만 확장자를 수렴한다. */
function resolveName(name: string, kind: EntryKind): string {
  return kind === "file" ? withMarkdownExtension(name) : name;
}

function isTaken(name: string, siblings: string[]): boolean {
  return siblings.some((sibling) => sibling.toLowerCase() === name.toLowerCase());
}

export function checkEntryName(
  name: string,
  siblings: string[],
  kind: EntryKind,
): EntryProblem | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return "empty";
  }
  if (trimmed.startsWith(".")) {
    return "hidden";
  }
  if (trimmed.includes("/") || hasControlChar(trimmed)) {
    return "invalid";
  }
  return isTaken(resolveName(trimmed, kind), siblings) ? "duplicate" : null;
}

/** 입력칸을 채울 이름 — 겹치면 빈 번호를 앞에서부터 찾는다. */
export function defaultEntryName(kind: EntryKind, siblings: string[]): string {
  const base = kind === "file" ? STRINGS.defaultFileName : STRINGS.defaultDirName;
  let index = 1;
  let name = resolveName(base, kind);
  while (isTaken(name, siblings)) {
    index += 1;
    name = resolveName(`${base} ${index}`, kind);
  }
  return name;
}
