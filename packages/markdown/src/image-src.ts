// 이미지 경로 해석 — 문서 폴더 기준의 절대 경로를 만든다(→ .claude/docs/preview-strategy.md#경로-해석).

// 스킴이 붙은 src(https:·data:·asset:…)는 이미 완결된 주소다. RFC 3986의 scheme 문법이다.
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** 퍼센트 인코딩을 푼다. 깨진 인코딩은 decodeURIComponent가 던지므로 원문을 쓴다. */
function decodePath(src: string): string {
  try {
    return decodeURIComponent(src);
  } catch {
    return src;
  }
}

/** `.`·`..`와 빈 조각을 없앤 절대 경로로 만든다. 루트 위로는 올라가지 않는다. */
function normalizeAbsolute(path: string): string {
  const resolved: string[] = [];
  for (const segment of path.split("/")) {
    if (segment === "" || segment === ".") {
      continue;
    }
    if (segment === "..") {
      resolved.pop();
      continue;
    }
    resolved.push(segment);
  }
  return `/${resolved.join("/")}`;
}

/** 이미지 경로를 푸는 기준 폴더 — 절대 경로다(→ .claude/docs/preview-strategy.md#경로-해석). */
export interface ImageBaseDirs {
  /** 문서가 있는 폴더. 경로 없는 문서(Untitled)는 `null`이다. */
  docDir: string | null;
  /** 사이드바로 연 폴더. 폴더를 열지 않았으면 `null`이다. */
  rootDir: string | null;
}

/**
 * 이미지 src를 절대 경로로 바꾼다. 바꿀 것이 없으면 `null`이다 —
 * 그때 프리뷰는 src를 그대로 둔다.
 */
export function resolveImagePath({ docDir, rootDir }: ImageBaseDirs, src: string): string | null {
  // 프로토콜을 생략한 원격 주소(//호스트/경로)는 경로가 아니다 — 이어 붙이면 주소가 망가진다.
  if (src === "" || HAS_SCHEME.test(src) || src.startsWith("//")) {
    return null;
  }
  const decoded = decodePath(src);
  const base = decoded.startsWith("/") ? rootDir : docDir;
  if (base === null) {
    return null;
  }
  return normalizeAbsolute(`${base}/${decoded}`);
}
