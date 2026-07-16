import { type RefObject, useEffect, useRef } from "react";

import { blockIndexForLine, collectLineBlocks, type LineBlock } from "@norii/markdown";

import {
  applyGuardedScrollTop,
  createEchoGuard,
  createSwapSuppressor,
  isAtBottom,
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
  /** 렌더 스왑 신호 — 값이 바뀌면 측정을 버린다. HTML 교체뿐 아니라 뒤늦게 도착하는
   * 다이어그램(→ use-mermaid.ts)처럼 블록 높이를 바꾸는 모든 사건이 여기 포함된다. */
  renderKey: string,
): void {
  const cacheRef = useRef<BlockPositionCache | null>(null);
  const swapSuppressorRef = useRef(createSwapSuppressor());
  // 마지막 scroll 이벤트 시점에 바닥이었는지 — 재렌더 후 바닥 고정의 판정 기준.
  const wasAtBottomRef = useRef(false);
  // 에코 가드는 두 효과(바닥 고정·이벤트 핸들러)가 공유한다 — 프로그램적 스크롤은
  // 예외 없이 이 가드와 짝을 맞춰야 한다(휴리스틱 의존 금지, 탭 전환 시 새로 만든다).
  const echoGuardRef = useRef(createEchoGuard());

  // 렌더 스왑 — 위치 캐시를 무효화하고, 브라우저의 scrollTop 강제 보정이 만드는
  // 진짜 scroll 이벤트가 동기화 신호로 새 나가는 것을 잠깐 막는다(→ scroll-sync).
  useEffect(() => {
    cacheRef.current = null;
    swapSuppressorRef.current.noteSwap();
    // 바닥 고정 — 바닥에서 타이핑하면 프리뷰가 '자라는데' 스크롤은 그대로라 새 내용이
    // 잘린다. 스왑 직전에 바닥이었다면 새 바닥으로 따라 내린다. 다른 프로그램적
    // 스크롤과 똑같이 가드 헬퍼를 경유한다 — 이 이벤트는 카운터로 정확히 상쇄된다.
    const pane = paneRef.current;
    if (pane && wasAtBottomRef.current) {
      applyGuardedScrollTop(echoGuardRef.current, pane, Number.MAX_SAFE_INTEGER);
    }
  }, [paneRef, renderKey]);

  useEffect(() => {
    const pane = paneRef.current;
    if (activeTabId === null || pane === null) {
      return;
    }
    // 바닥 기억은 탭 경계를 넘지 않는다 — 이전 탭의 기억이 남으면 새 탭 프리뷰가
    // 렌더 직후 바닥으로 점프할 수 있다(현재는 에디터의 탭 전환 리셋 신호가 우연한
    // 순서로 덮어주지만, 순서에 기대지 않고 여기서 결정적으로 끊는다).
    wasAtBottomRef.current = false;
    // 에코 가드도 탭마다 새로 — 이전 탭에서 arm만 되고 소비되지 않은 카운트가
    // 새 탭의 진짜 사용자 스크롤을 삼키지 않게 한다.
    echoGuardRef.current = createEchoGuard();
    const echoGuard = echoGuardRef.current;

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
      // 발행 여부와 무관하게 실제 위치는 항상 추적한다(바닥 고정 판정용).
      wasAtBottomRef.current = isAtBottom(pane);
      if (echoGuard.shouldIgnore()) {
        return;
      }
      // 렌더 스왑 직후 창 안에서는 "브라우저의 클램프 보정"(본문이 짧아져 scrollTop이
      // 맨 아래로 잘린 경우)만 무시한다 — 진짜 사용자 스크롤은 창 안이라도 발행한다.
      if (swapSuppressorRef.current.shouldIgnore()) {
        const maxTop = Math.max(0, pane.scrollHeight - pane.clientHeight);
        if (Math.abs(pane.scrollTop - maxTop) < 1) {
          return;
        }
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
      // 진행률 1(하단 여백 구간)에서 endLine+1로 넘치지 않게 (endLine, 1)로 자른다.
      const lineSpan = block.endLine - block.line + 1;
      const lineOffset = progress * lineSpan;
      const flooredLine = block.line + Math.floor(lineOffset);
      const overflow = flooredLine > block.endLine;
      publishScroll("preview", {
        line: overflow ? block.endLine : flooredLine,
        fraction: overflow ? 1 : lineOffset - Math.floor(lineOffset),
        // 바닥에 닿으면 가장자리 스냅 — 반대 패널도 바닥으로 정렬된다.
        ...(isAtBottom(pane) ? { edge: "bottom" as const } : {}),
      });
    };
    pane.addEventListener("scroll", handleScroll);

    // 창 크기가 바뀌면 블록 위치가 이동한다 — 캐시만 버리면 다음 이벤트가 재측정한다.
    const handleResize = () => {
      cacheRef.current = null;
    };
    window.addEventListener("resize", handleResize);

    const unsubscribe = subscribeScroll("preview", ({ line, fraction, edge }) => {
      // 가장자리 스냅: 상대가 바닥이면 블록 계산 대신 우리 바닥으로(헬퍼가 max로 클램프).
      if (edge === "bottom") {
        applyGuardedScrollTop(echoGuard, pane, Number.MAX_SAFE_INTEGER);
        return;
      }
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
