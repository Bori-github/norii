import { type RefObject, useEffect, useState } from "react";

import { STRINGS } from "@shared/config";

/** 로드에 실패한 이미지에 붙는 표시 — 프리뷰 CSS가 이 이름으로 그 이미지를 감춘다. */
export const BROKEN_IMAGE_ATTR = "data-norii-broken";

/** 감춘 이미지 자리에 넣는 대체 텍스트 — 프리뷰 CSS가 이 이름으로 흐린 글자를 그린다. */
export const BROKEN_ALT_ATTR = "data-norii-broken-alt";

// img에 display:none을 걸고 뒤에 span을 넣는 이유(브라우저가 alt를 글자로 표시하지 않고
// ::after도 그리지 않는다)는 preview-strategy.md#못-찾은-이미지가 소유한다.
function showAltTextInstead(image: HTMLImageElement): void {
  if (image.hasAttribute(BROKEN_IMAGE_ATTR)) {
    return;
  }
  image.setAttribute(BROKEN_IMAGE_ATTR, "");
  const fallback = document.createElement("span");
  fallback.setAttribute(BROKEN_ALT_ATTR, "");
  // 설명이 없는 이미지(`![](…)`)도 자리를 비우지 않는다 — 왜 안 뜨는지 알 수 있어야 한다.
  fallback.textContent = image.getAttribute("alt") || STRINGS.previewImageMissing;
  image.after(fallback);
}

/**
 * 이미지 도착을 세는 리비전 — 오를 때마다 스크롤 동기화가 블록을 다시 잰다
 * (→ .claude/docs/preview-strategy.md#이미지가-도착하면-블록을-다시-잰다).
 */
export function useImageLoads(contentRef: RefObject<HTMLElement | null>, html: string): number {
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const content = contentRef.current;
    if (content === null) {
      return;
    }
    // load·error는 버블하지 않으므로 캡처로 받는다. 이미지마다 리스너를 달면 문서 하나에
    // 수십 개가 생기고 갱신마다 다시 등록된다.
    const onSettled = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLImageElement)) {
        return;
      }
      if (event.type === "error") {
        showAltTextInstead(target);
      }
      setRevision((current) => current + 1);
    };
    content.addEventListener("load", onSettled, true);
    content.addEventListener("error", onSettled, true);
    return () => {
      content.removeEventListener("load", onSettled, true);
      content.removeEventListener("error", onSettled, true);
    };
    // html이 바뀌면 내용이 통째로 교체되어 이전 img가 사라진다 — 리스너를 다시 건다.
  }, [contentRef, html]);

  return revision;
}
