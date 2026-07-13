import { type RefObject, useEffect, useRef } from "react";

import { blockIndexForLine, collectLineBlocks, type LineBlock } from "@norii/markdown";

import {
  applyGuardedScrollTop,
  createEchoGuard,
  publishScroll,
  subscribeScroll,
} from "@features/scroll-sync";

// 프리뷰 쪽 스크롤 동기화 — 라인 매핑 테이블(packages/markdown)로 "스크롤 위치 ↔ 소스
// 라인"을 변환해 중계소와 주고받는다(→ preview-strategy.md#스크롤-동기화).
// 블록 단위 근사가 사양이다 — 블록 안에서는 높이 비율로 보간한다.
//
// 성능: 블록 목록·상단 위치는 렌더(스왑)·리사이즈 단위로 1회만 측정해 캐시한다.
// 스크롤 이벤트마다 전체 DOM을 재측정하면 큰 문서에서 스크롤이 버벅인다(성능 규칙).

interface BlockPositionCache {
  blocks: LineBlock[];
  /** 각 블록 상단의 패널 스크롤 좌표(문서 순서 = 오름차순). */
  tops: number[];
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

/** tops에서 value 이하인 마지막 인덱스(이진 탐색). 없으면 0. */
function indexAtOrBelow(tops: number[], value: number): number {
  let low = 0;
  let high = tops.length - 1;
  let found = 0;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if ((tops[mid] ?? 0) <= value) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found;
}

export function usePreviewScrollSync(
  paneRef: RefObject<HTMLDivElement | null>,
  activeTabId: string | null,
  html: string,
): void {
  const cacheRef = useRef<BlockPositionCache | null>(null);

  // 렌더 스왑 — 블록 DOM이 갈렸으므로 위치 캐시를 무효화한다.
  useEffect(() => {
    cacheRef.current = null;
  }, [html]);

  useEffect(() => {
    const pane = paneRef.current;
    if (activeTabId === null || pane === null) {
      return;
    }
    const echoGuard = createEchoGuard();

    const measured = (): BlockPositionCache => {
      let cache = cacheRef.current;
      if (!cache) {
        const blocks = collectLineBlocks(pane);
        // 패널 rect는 1회만 읽는다 — 블록 상단을 패널 스크롤 좌표로 환산.
        const paneOrigin = pane.getBoundingClientRect().top - pane.scrollTop;
        const tops = blocks.map((block) => block.element.getBoundingClientRect().top - paneOrigin);
        cache = { blocks, tops };
        cacheRef.current = cache;
      }
      return cache;
    };

    const handleScroll = () => {
      if (echoGuard.shouldIgnore()) {
        return;
      }
      const { blocks, tops } = measured();
      if (blocks.length === 0) {
        return;
      }
      const index = indexAtOrBelow(tops, pane.scrollTop);
      const block = blocks[index];
      const top = tops[index];
      if (block === undefined || top === undefined) {
        return;
      }
      const height = block.element.offsetHeight || 1;
      const progress = clamp01((pane.scrollTop - top) / height);
      // 블록이 걸친 소스 라인 범위(시작~끝)에 진행률을 펴서 라인+진행률로 변환한다.
      const lineSpan = block.endLine - block.line + 1;
      const lineOffset = progress * lineSpan;
      publishScroll("preview", {
        line: block.line + Math.floor(lineOffset),
        fraction: lineOffset - Math.floor(lineOffset),
      });
    };
    pane.addEventListener("scroll", handleScroll);

    // 창 크기가 바뀌면 블록 위치가 이동한다 — 캐시만 버리면 다음 이벤트가 재측정한다.
    const handleResize = () => {
      cacheRef.current = null;
    };
    window.addEventListener("resize", handleResize);

    const unsubscribe = subscribeScroll("preview", ({ line, fraction }) => {
      const { blocks, tops } = measured();
      const index = blockIndexForLine(blocks, line);
      const block = blocks[index];
      const top = tops[index];
      if (block === undefined || top === undefined) {
        return;
      }
      const lineSpan = block.endLine - block.line + 1;
      const progress = clamp01((line - block.line + fraction) / lineSpan);
      // 클램프·"이미 그 자리" 판정·arm 짝 맞춤은 공용 헬퍼가 보장한다(→ features/scroll-sync).
      applyGuardedScrollTop(echoGuard, pane, top + block.element.offsetHeight * progress);
    });

    return () => {
      pane.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
      unsubscribe();
    };
  }, [paneRef, activeTabId]);
}
