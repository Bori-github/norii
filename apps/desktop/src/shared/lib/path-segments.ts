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
