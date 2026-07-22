import { type RefObject, useEffect, useRef, useState } from "react";

// 콜아웃 라벨의 위젯 쪽 재료 — 포털 대상 수집. 왜 파서가 아니라 여기서 붙이는지는
// preview-strategy.md#콜아웃-gfm-alerts가 소유한다. 복사 버튼과 같은 경로다(→ use-code-copy.ts).

/** 테스트가 아이콘을 찾는 클래스. */
export const CALLOUT_ICON_CLASS = "norii-callout-icon";

/** 파서가 붙이는 클래스(`norii-callout-<kind>`)의 접미사. */
export const CALLOUT_KINDS = ["note", "tip", "important", "warning", "caution"] as const;

export type CalloutKind = (typeof CALLOUT_KINDS)[number];

export interface CalloutTarget {
  /** 포털 key — 내용 교체마다 새로 발급한다(→ use-code-copy.ts의 같은 규칙). */
  key: string;
  kind: CalloutKind;
  element: HTMLElement;
}

/**
 * 프리뷰 내용의 콜아웃 상자를 종류와 함께 수집한다.
 * 5종 밖의 인용문은 파서가 종류 클래스를 붙이지 않으므로 걸리지 않는다.
 */
export function useCallouts(
  contentRef: RefObject<HTMLElement | null>,
  html: string,
): CalloutTarget[] {
  const [targets, setTargets] = useState<CalloutTarget[]>([]);
  const swapSeqRef = useRef(0);

  useEffect(() => {
    const content = contentRef.current;
    if (content === null) {
      return;
    }
    swapSeqRef.current += 1;
    const swap = swapSeqRef.current;
    setTargets(
      CALLOUT_KINDS.flatMap((kind) =>
        [...content.querySelectorAll<HTMLElement>(`blockquote.norii-callout-${kind}`)].map(
          (element, index) => ({ key: `${swap}-${kind}-${index}`, kind, element }),
        ),
      ),
    );
  }, [contentRef, html]);

  return targets;
}
