import { type RefObject, useEffect, useState } from "react";

import { decodeMermaidSource, MERMAID_CODE_ATTR, MERMAID_PLACEHOLDER_CLASS } from "@norii/markdown";

import { useResolvedTheme } from "@entities/theme";
import { STRINGS } from "@shared/config";

// 다이어그램 렌더 — 파서가 낸 빈 플레이스홀더를 SVG로 채운다(→ preview-strategy.md#다이어그램-mermaid).
//
// 이 훅이 지는 세 가지 부담:
//   1) lazy-load — mermaid는 무겁다(d3 동반). 문서에 다이어그램이 **있을 때만** import한다.
//      번들 크기가 아니라 기동 비용을 지키는 장치다(청크는 어차피 앱에 들어간다).
//   2) 캐시 — 디바운스 갱신마다 전부 다시 그리지 않는다. (테마, 원문)이 같으면 이전 SVG를
//      그대로 다시 꽂는다. 타이핑 중 다이어그램이 매번 깜빡이지 않게 하는 것이 목적이다.
//   3) sanitize 경계의 뒤집힘 — 원문은 이미 DOMPurify를 통과했고, 여기서 넣는 SVG는 신뢰된
//      엔진 출력이다. securityLevel 'strict'가 라벨 속 스크립트·HTML을 봉쇄한다.

type MermaidApi = typeof import("mermaid").default;

let mermaidPromise: Promise<MermaidApi> | null = null;

function loadMermaid(): Promise<MermaidApi> {
  mermaidPromise ??= import("mermaid").then((module) => module.default);
  return mermaidPromise;
}

// 렌더 결과 캐시 — 키는 (테마, 원문). 프리뷰가 스왑돼도 살아남아야 하므로 모듈 수준이다.
const svgCache = new Map<string, string>();
// mermaid는 렌더마다 고유 id를 요구한다(같은 id를 재사용하면 임시 노드가 충돌한다).
let renderSeq = 0;

function cacheKey(theme: string, code: string): string {
  return `${theme}\u0000${code}`;
}

/**
 * 프리뷰 DOM의 mermaid 플레이스홀더를 SVG로 채우고, 채울 때마다 리비전을 올린다.
 *
 * 리비전은 스크롤 동기화가 다시 측정해야 한다는 신호다 — 다이어그램은 **비동기로 도착해**
 * 블록 높이를 바꾸므로, 그 전에 잰 블록 위치는 낡은 값이 된다.
 */
export function useMermaid(paneRef: RefObject<HTMLElement | null>, html: string): number {
  const theme = useResolvedTheme();
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const pane = paneRef.current;
    if (pane === null) {
      return;
    }
    const placeholders = [...pane.querySelectorAll<HTMLElement>(`.${MERMAID_PLACEHOLDER_CLASS}`)];
    if (placeholders.length === 0) {
      return;
    }

    // 프리뷰가 다시 스왑되면(다음 타이핑) 이 실행은 낡은 DOM을 그린다 — 즉시 버린다.
    let cancelled = false;

    const paint = async () => {
      const mermaid = await loadMermaid();
      if (cancelled) {
        return;
      }
      // 테마는 매번 다시 지정한다 — 사용자가 테마를 바꾸면 같은 문서를 다른 색으로 그린다.
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: theme === "dark" ? "dark" : "default",
      });

      let painted = false;
      for (const placeholder of placeholders) {
        const encoded = placeholder.getAttribute(MERMAID_CODE_ATTR);
        if (encoded === null) {
          continue;
        }
        const code = decodeMermaidSource(encoded);
        const key = cacheKey(theme, code);
        const cached = svgCache.get(key);
        if (cached !== undefined) {
          placeholder.innerHTML = cached;
          painted = true;
          continue;
        }
        renderSeq += 1;
        const id = `norii-mermaid-${renderSeq}`;
        try {
          const { svg } = await mermaid.render(id, code);
          if (cancelled) {
            return;
          }
          svgCache.set(key, svg);
          placeholder.innerHTML = svg;
        } catch {
          if (cancelled) {
            return;
          }
          // 문법 오류는 사용자가 고칠 수 있는 일상이다 — 앱을 깨거나 배너를 띄우지 않고
          // 그 자리에만 알린다. 실패는 캐시하지 않는다(고치는 즉시 다시 시도해야 한다).
          placeholder.textContent = STRINGS.mermaidRenderError;
          // mermaid는 실패 시 임시 노드를 문서에 남긴다 — 우리가 치운다.
          document.getElementById(id)?.remove();
        }
        painted = true;
      }
      if (!cancelled && painted) {
        setRevision((current) => current + 1);
      }
    };

    void paint();

    return () => {
      cancelled = true;
    };
  }, [paneRef, html, theme]);

  return revision;
}
