import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resetTabTextRegistry, setTabText, useDocumentStore } from "@entities/document";
import { resetScrollSync } from "@features/scroll-sync";
import { STRINGS } from "@shared/config";

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
  // 스크롤 중계소 싱글턴도 초기화 — 테스트 간 구독 누수 방지(editor-page 테스트와 동일).
  resetScrollSync();
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

  it("연속 본문 변경은 디바운스로 모아 렌더한다 — 키 입력마다 재파싱하지 않는다(성능 규칙)", async () => {
    const tabId = openTabWith("# 0");
    const { container } = render(<PreviewPane />);
    await waitFor(() => expect(container.querySelector("h1")?.textContent).toBe("0"));
    const seen: string[] = [];
    const observer = new MutationObserver(() => {
      const text = container.querySelector("h1")?.textContent;
      if (text !== undefined && text !== null) {
        seen.push(text);
      }
    });
    observer.observe(container, { subtree: true, childList: true, characterData: true });
    // 디바운스 창(기본 150ms)보다 훨씬 빠른 연속 변경 — 마지막 값만 렌더돼야 한다.
    for (let i = 1; i <= 5; i += 1) {
      setTabText(tabId, `# ${i}`);
    }
    await waitFor(() => expect(container.querySelector("h1")?.textContent).toBe("5"));
    observer.disconnect();
    expect(seen).not.toContain("1");
    expect(seen).not.toContain("2");
  });

  it("링크 클릭은 웹뷰 내비게이션을 차단한다 — 앱이 문서 속 링크로 이동하지 않는다", async () => {
    openTabWith("[외부 링크](https://example.com)");
    const { container } = render(<PreviewPane />);
    const anchor = await waitFor(() => {
      const found = container.querySelector("a[href]");
      expect(found).not.toBeNull();
      return found as HTMLAnchorElement;
    });
    const clickEvent = new MouseEvent("click", { bubbles: true, cancelable: true });
    const notCanceled = anchor.dispatchEvent(clickEvent);
    // dispatchEvent가 false면 preventDefault가 호출된 것 — 내비게이션 차단.
    expect(notCanceled).toBe(false);
  });

  // 왜: 프리뷰는 스크롤되는 독립 영역인데 포커스를 못 받으면 키보드만 쓰는 사용자는
  //     방향키로 읽을 수 없다(마우스 없이는 프리뷰가 잠긴다).
  // 보장: 패널이 포커스 가능하고, 스크린리더가 이름으로 찾을 수 있는 영역이다.
  // 경계: 포커스 링의 시각 표현은 실앱·수동 확인의 몫이다(CSS는 여기 없다).
  it("프리뷰 패널은 키보드로 포커스할 수 있는 이름 있는 영역이다", async () => {
    openTabWith("# 제목");
    const { container } = render(<PreviewPane />);
    const pane = await waitFor(() => {
      const found = container.querySelector('[data-testid="preview-pane"]');
      expect(found).not.toBeNull();
      return found as HTMLElement;
    });
    expect(pane.tabIndex).toBe(0);
    expect(pane.getAttribute("role")).toBe("region");
    expect(pane.getAttribute("aria-label")).toBe(STRINGS.previewRegionLabel);

    pane.focus();
    expect(document.activeElement).toBe(pane);
  });
});
