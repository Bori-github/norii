import { openUrl } from "@tauri-apps/plugin-opener";

import { logger } from "@shared/lib";

// 프리뷰의 외부 링크 판정 — 정책·근거의 단일 출처는 .claude/docs/security.md의
// "4. 외부 링크"다. 여기 주석은 그 정책을 되풀이하지 않고 코드가 지키는 불변식만 적는다.

/**
 * OS로 넘길 수 있는 스킴(허용 집합의 단일 출처는 security.md).
 * **capabilities의 opener 스코프와 값이 일치해야 한다** — 어긋나면 링크가 조용히 죽는다.
 * 그 일치는 allowlist-drift.test.ts가 지킨다(설정 파일은 타입체크가 잡지 못한다).
 */
export const ALLOWED_PROTOCOLS = ["http:", "https:", "mailto:"] as const;

const ALLOWED_PROTOCOL_SET: ReadonlySet<string> = new Set(ALLOWED_PROTOCOLS);

/**
 * 링크를 OS로 넘길 수 있으면 정규화된 URL을, 아니면 null(무동작)을 돌려준다.
 * 판정은 URL 파싱으로 한다 — 문자열 접두사 비교는 대소문자·공백·개행 위장에 뚫린다.
 * 상대 경로·앵커는 절대 URL이 아니므로 자연히 거부된다(문서 내 이동은 아직 과제).
 */
export function externalUrlOf(href: string): string | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  return ALLOWED_PROTOCOL_SET.has(url.protocol) ? url.href : null;
}

/** 허용된 링크만 OS 기본 브라우저로 연다. 실패는 로그로 남기고 앱을 깨뜨리지 않는다. */
export function openExternalLink(href: string): void {
  const url = externalUrlOf(href);
  if (url === null) {
    return;
  }
  void openUrl(url).catch((cause: unknown) => {
    // 사용자 문서의 URL은 민감정보일 수 있어 메시지에 넣지 않는다(→ error-handling.md).
    logger.error(`외부 링크를 열지 못했습니다: ${String(cause)}`);
  });
}
