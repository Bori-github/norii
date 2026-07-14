// 문서 내 앵커 이동 — `#앵커` 링크는 앱이 직접 해석한다(→ preview-strategy.md#링크-정책).
//
// 이 링크는 문서 밖으로 나가지 않으므로 스킴 허용목록(외부 링크)의 대상이 아니다.
// 각주(#fn1·#fnref1)와 헤딩 slug(#개요)가 이 경로를 탄다.

/** `#앵커` 링크인가 — 판정은 한 곳에서만 한다(호출 측이 문자열을 다시 뜯지 않도록). */
export function isAnchorHref(href: string): boolean {
  return href.startsWith("#") && href.length > 1;
}

/**
 * 앵커 대상으로 프리뷰를 스크롤한다. 대상을 못 찾으면 아무 일도 하지 않는다(끊긴 앵커).
 *
 * **에코 가드를 경유하지 않는다.** 가드는 "이 스크롤은 발행하지 마라"는 표시라, 경유하면
 * 에디터가 따라오지 않는다. 앵커 클릭은 사용자가 일으킨 이동이므로 평범한 스크롤로 적용하고,
 * 그 결과 나는 scroll 이벤트가 평소대로 발행되어 에디터가 함께 움직인다. 왕복 루프는 수신
 * 측(에디터)이 이미 가드를 쓰기 때문에 생기지 않는다(→ features/scroll-sync).
 */
export function scrollToAnchor(pane: HTMLElement, content: ParentNode, href: string): void {
  // 대상은 **프리뷰 콘텐츠 안에서만** 찾는다 — 문서 전체에서 찾으면 프리뷰 밖 앱 UI의
  // 같은 id를 잡는다. href는 퍼센트 인코딩될 수 있어(#%EA%B0%9C%EC%9A%94) 먼저 되돌린다.
  let id: string;
  try {
    id = decodeURIComponent(href.slice(1));
  } catch {
    return; // 잘못 인코딩된 링크 — 조용한 무동작
  }
  const target = content.querySelector(`[id="${CSS.escape(id)}"]`);
  if (target === null) {
    return;
  }
  // 패널 rect는 한 번만 읽어 스크롤 좌표로 환산한다(스크롤 동기화의 측정과 같은 방식).
  const paneOrigin = pane.getBoundingClientRect().top - pane.scrollTop;
  pane.scrollTop = target.getBoundingClientRect().top - paneOrigin;
}
