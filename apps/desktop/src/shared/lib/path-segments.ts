/**
 * 경로의 마지막 항목 이름(파일명·폴더명).
 *
 * Windows canonical 경로(\\?\C:\...)까지 고려해 양쪽 구분자를 다룬다(→ platform-strategy.md).
 */
export function entryNameOf(path: string): string {
  const name = path.split(/[/\\]/).at(-1);
  return name && name.length > 0 ? name : path;
}

/**
 * 연 폴더와 파일 사이의 폴더 이름을 순서대로 돌려준다.
 *
 * 두 경로 모두 Rust가 canonicalize한 값이라 `.`·`..`·중복 슬래시가 없다(→ rust-commands.md).
 */
export function pathSegmentsWithinRoot(
  filePath: string | null,
  rootDir: string | null,
): readonly string[] {
  if (filePath === null || rootDir === null) {
    return [];
  }
  const root = rootDir.endsWith("/") ? rootDir.slice(0, -1) : rootDir;
  if (!filePath.startsWith(`${root}/`)) {
    return [];
  }
  return filePath
    .slice(root.length + 1)
    .split("/")
    .slice(0, -1);
}
