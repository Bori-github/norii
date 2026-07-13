import { openUrl } from "@tauri-apps/plugin-opener";

import { logger } from "@shared/lib";

// 프리뷰의 외부 링크 — 문서는 신뢰하지 않는 입력이다(→ security.md#4-외부-링크).
// 웹뷰 내비게이션은 항상 막고, 안전한 스킴만 OS 기본 브라우저로 넘긴다.

/** OS로 넘길 수 있는 스킴. file:·커스텀 스킴은 앱 실행·로컬 파일 열기 통로라 제외한다. */
const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

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
  return ALLOWED_PROTOCOLS.has(url.protocol) ? url.href : null;
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
