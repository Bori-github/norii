import { type RefObject, useEffect } from "react";

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

/** 패널 스크롤 좌표계에서의 블록 상단 위치. */
function blockTopOf(pane: HTMLElement, element: HTMLElement): number {
  return element.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop;
}

export function usePreviewScrollSync(
  paneRef: RefObject<HTMLDivElement | null>,
  activeTabId: string | null,
): void {
  useEffect(() => {
    const pane = paneRef.current;
    if (activeTabId === null || pane === null) {
      return;
    }
    const echoGuard = createEchoGuard();
    // 매 이벤트 시점에 수집한다 — 디바운스 렌더로 DOM이 갈리는 것을 자연히 반영한다.
    const blocks = (): LineBlock[] => collectLineBlocks(pane);

    const handleScroll = () => {
      if (echoGuard.shouldIgnore()) {
        return;
      }
      const list = blocks();
      if (list.length === 0) {
        return;
      }
      // 뷰포트 상단에 걸친 블록 — 상단 위치 ≤ scrollTop인 마지막 블록.
      let current = list[0] as LineBlock;
      for (const block of list) {
        if (blockTopOf(pane, block.element) <= pane.scrollTop) {
          current = block;
        } else {
          break;
        }
      }
      const height = current.element.offsetHeight || 1;
      const progress = Math.min(
        Math.max((pane.scrollTop - blockTopOf(pane, current.element)) / height, 0),
        1,
      );
      // 블록이 걸친 소스 라인 범위(시작~끝)에 진행률을 펴서 라인+진행률로 변환한다.
      const lineSpan = current.endLine - current.line + 1;
      const lineOffset = progress * lineSpan;
      publishScroll("preview", {
        line: current.line + Math.floor(lineOffset),
        fraction: lineOffset - Math.floor(lineOffset),
      });
    };
    pane.addEventListener("scroll", handleScroll);

    const unsubscribe = subscribeScroll("preview", ({ line, fraction }) => {
      const list = blocks();
      const index = blockIndexForLine(list, line);
      const block = list[index];
      if (!block) {
        return;
      }
      const lineSpan = block.endLine - block.line + 1;
      // 진행률은 아래위 모두 클램프한다 — 하한이 없으면 음수 목표가 나올 수 있다.
      const progress = Math.min(Math.max((line - block.line + fraction) / lineSpan, 0), 1);
      // 클램프·"이미 그 자리" 판정·arm 짝 맞춤은 공용 헬퍼가 보장한다(→ features/scroll-sync).
      applyGuardedScrollTop(
        echoGuard,
        pane,
        blockTopOf(pane, block.element) + block.element.offsetHeight * progress,
      );
    });

    return () => {
      pane.removeEventListener("scroll", handleScroll);
      unsubscribe();
    };
  }, [paneRef, activeTabId]);
}
