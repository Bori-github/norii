import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resetTabTextRegistry, setTabText, useDocumentStore } from "@entities/document";

import { PreviewPane } from "../index";

// 집행: preview-strategy.md — 분할 프리뷰. 파이프라인(markdown-it+DOMPurify)은
// packages/markdown이 만들고, 이 위젯은 DOM 삽입·갱신만 책임진다.
//
// 왜: 프리뷰가 활성 탭을 따라가지 않거나 변경을 반영하지 않으면 사용자는 낡은 화면을
//     보고 편집한다. 삽입 지점은 XSS의 마지막 관문이기도 하다.
// 보장: 활성 탭 본문이 렌더되고, 본문 변경(타이핑·교체)이 디바운스 뒤 반영되며,
//       삽입 HTML은 sanitize를 거친다(통합 확인 1건 — 정책 상세는 packages/markdown 테스트).
// 경계: 스크롤 동기화(별도 feature)·디바운스 구체 값(M3 마감 실측)·타이포그래피는
//       다루지 않는다. 실제 WKWebView 충실도는 실앱 E2E 계층의 몫이다.

beforeEach(() => {
  useDocumentStore.setState({ tabs: [], activeTabId: null });
  resetTabTextRegistry();
});

afterEach(() => {
  cleanup();
});

function openTabWith(text: string): string {
  const id = useDocumentStore.getState().addUntitledTab();
  setTabText(id, text);
  return id;
}

describe("PreviewPane", () => {
  it("활성 탭의 마크다운을 렌더한다", async () => {
    openTabWith("# 제목\n\n본문");
    const { container } = render(<PreviewPane />);
    await waitFor(() => {
      expect(container.querySelector("h1")?.textContent).toBe("제목");
      expect(container.querySelector("p")?.textContent).toBe("본문");
    });
  });

  it("활성 탭이 없으면 아무것도 그리지 않는다", () => {
    const { container } = render(<PreviewPane />);
    expect(container.firstChild).toBeNull();
  });

  it("본문 변경이 디바운스 뒤 프리뷰에 반영된다", async () => {
    const tabId = openTabWith("# 하나");
    const { container } = render(<PreviewPane />);
    await waitFor(() => expect(container.querySelector("h1")?.textContent).toBe("하나"));
    setTabText(tabId, "# 둘");
    await waitFor(() => expect(container.querySelector("h1")?.textContent).toBe("둘"));
  });

  it("탭을 전환하면 새 활성 탭의 본문으로 바뀐다", async () => {
    const firstId = openTabWith("# 첫 탭");
    openTabWith("# 둘째 탭");
    const { container } = render(<PreviewPane />);
    await waitFor(() => expect(container.querySelector("h1")?.textContent).toBe("둘째 탭"));
    useDocumentStore.getState().activateTab(firstId);
    await waitFor(() => expect(container.querySelector("h1")?.textContent).toBe("첫 탭"));
  });

  it("삽입 HTML은 sanitize를 거친다 — 스크립트 태그가 프리뷰에 들어가지 않는다", async () => {
    openTabWith('본문\n\n<script>document.title = "pwned";</script>');
    const { container } = render(<PreviewPane />);
    await waitFor(() => expect(container.textContent).toContain("본문"));
    expect(container.querySelector("script")).toBeNull();
  });
});
