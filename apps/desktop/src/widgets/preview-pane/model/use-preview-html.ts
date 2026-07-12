import { useEffect, useState } from "react";

import { renderMarkdown } from "@norii/markdown";

import { getTabText, subscribeDocChanged } from "@entities/document";

import { PREVIEW_DEBOUNCE_MS } from "../config";

// 활성 탭의 sanitize된 프리뷰 HTML — 탭 전환은 즉시 렌더하고, 본문 변경(타이핑·교체)은
// 디바운스로 모아 렌더한다(→ preview-strategy.md#디바운스).
export function usePreviewHtml(tabId: string | null): string {
  const [html, setHtml] = useState("");

  useEffect(() => {
    if (tabId === null) {
      setHtml("");
      return;
    }
    setHtml(renderMarkdown(getTabText(tabId) ?? ""));

    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribeDocChanged((changedTabId) => {
      if (changedTabId !== tabId) {
        return;
      }
      if (timer !== null) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        setHtml(renderMarkdown(getTabText(tabId) ?? ""));
      }, PREVIEW_DEBOUNCE_MS);
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
