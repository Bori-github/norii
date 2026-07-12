import { useEffect, useState } from "react";

import { renderMarkdown } from "@norii/markdown";

import { getTabText, subscribeDocChanged } from "@entities/document";

import { adaptiveDebounceMs, PREVIEW_DEBOUNCE_BASE_MS } from "../config";

// 활성 탭의 sanitize된 프리뷰 HTML — 탭 전환은 즉시 렌더하고, 본문 변경(타이핑·교체)은
// 적응형 디바운스로 모아 렌더한다(→ preview-strategy.md#디바운스).
export function usePreviewHtml(tabId: string | null): string {
  const [html, setHtml] = useState("");

  useEffect(() => {
    if (tabId === null) {
      setHtml("");
      return;
    }
    // 직전 렌더 소요로 다음 디바운스를 정한다 — 큰 문서일수록 간격을 벌려 타이핑 버벅임을 막는다.
    let debounceMs = PREVIEW_DEBOUNCE_BASE_MS;
    const renderNow = () => {
      const start = performance.now();
      const rendered = renderMarkdown(getTabText(tabId) ?? "");
      debounceMs = adaptiveDebounceMs(performance.now() - start);
      setHtml(rendered);
    };
    renderNow();

    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribeDocChanged((changedTabId) => {
      if (changedTabId !== tabId) {
        return;
      }
      if (timer !== null) {
        clearTimeout(timer);
      }
      timer = setTimeout(renderNow, debounceMs);
    });

    return () => {
      unsubscribe();
      if (timer !== null) {
        clearTimeout(timer);
      }
    };
  }, [tabId]);

  return html;
}
