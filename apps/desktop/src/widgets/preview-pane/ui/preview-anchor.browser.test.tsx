import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import "@app/index.css";

import { resetTabTextRegistry, setTabText, useDocumentStore } from "@entities/document";
import { resetScrollSync, subscribeScroll } from "@features/scroll-sync";

import { PreviewPane } from "../index";

// 집행: preview-strategy.md#링크-정책 — `#앵커`는 문서 밖으로 나가지 않으므로 스킴 허용목록
// 판정 이전에 갈라지고, 앱이 프리뷰를 그 위치로 스크롤한다.
//
// 왜: M4가 각주를 넣었지만 눌러도 아무 일이 없었다 — 모든 링크를 "외부로 나갈 것"으로만
//     취급해 #앵커가 무동작에 걸렸기 때문이다. 목차 링크도 같은 이유로 죽어 있었다.
// 보장: 각주 참조·되돌아가기·목차 링크가 프리뷰를 이동시키고, 그 이동이 에디터에도 전달되며,
//       웹뷰는 여전히 이동하지 않는다. 끊긴 앵커는 조용히 무시한다.
// 경계: 상대 경로로 다른 .md를 여는 것은 이 계약 밖이다(열린 결정).

beforeEach(() => {
  useDocumentStore.setState({ tabs: [], activeTabId: null });
  resetTabTextRegistry();
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

/** 스크롤이 일어나려면 문서가 화면보다 길어야 한다 — 사이를 긴 본문으로 채운다. */
const FILLER = Array.from({ length: 60 }, (_, i) => `채움 문단 ${i}`).join("\n\n");

/**
 * 패널에 높이를 준다 — 실앱은 flex 레이아웃이 화면 높이를 주지만, 테스트에서 위젯만 띄우면
 * 패널이 내용만큼 늘어나 **스크롤 자체가 불가능**해진다(scrollTop이 0에 묶인다).
 */
function mountPane(container: HTMLElement): HTMLElement {
  const pane = container.querySelector('[data-testid="preview-pane"]') as HTMLElement;
  expect(pane).not.toBeNull();
  pane.style.height = "300px";
  return pane;
}

async function clickLink(container: HTMLElement, selector: string): Promise<boolean> {
  const anchor = await waitFor(() => {
    const found = container.querySelector(selector);
    expect(found).not.toBeNull();
    return found as HTMLAnchorElement;
  });
  const event = new MouseEvent("click", { bubbles: true, cancelable: true });
  // dispatchEvent가 false면 preventDefault가 호출된 것 — 웹뷰 내비게이션 차단.
  return anchor.dispatchEvent(event);
}

/**
 * 링크를 글자로 찾는다 — 한글 앵커의 href는 **퍼센트 인코딩**되어 나오므로
 * (`#결론` → `#%EA%B2%B0%EB%A1%A0`) href로 찾으면 잡히지 않는다. 우리 구현이 디코딩을
 * 하는 이유이기도 하다.
 */
async function clickLinkByText(container: HTMLElement, text: string): Promise<boolean> {
  const anchor = await waitFor(() => {
    const found = [...container.querySelectorAll("a")].find((a) => a.textContent === text);
    expect(found).toBeDefined();
    return found as HTMLAnchorElement;
  });
  const event = new MouseEvent("click", { bubbles: true, cancelable: true });
  return anchor.dispatchEvent(event);
}

describe("프리뷰 — 문서 내 앵커 이동", () => {
  it("각주 참조를 누르면 각주 목록으로 스크롤한다", async () => {
    openTabWith(`본문[^1]\n\n${FILLER}\n\n[^1]: 각주 내용`);
    const { container } = render(<PreviewPane />);
    const pane = mountPane(container);
    expect(pane.scrollTop).toBe(0);

    const notCanceled = await clickLink(container, "sup a");
    expect(notCanceled).toBe(false);
    await waitFor(() => expect(pane.scrollTop).toBeGreaterThan(0));
  });

  it("되돌아가기 화살표를 누르면 참조 자리로 돌아온다", async () => {
    openTabWith(`본문[^1]\n\n${FILLER}\n\n[^1]: 각주 내용`);
    const { container } = render(<PreviewPane />);
    const pane = mountPane(container);

    await clickLink(container, "sup a");
    const atFootnote = await waitFor(() => {
      expect(pane.scrollTop).toBeGreaterThan(0);
      return pane.scrollTop;
    });
    await clickLink(container, ".footnote-backref");
    // 참조는 문서 맨 앞이지만 상단 여백 때문에 scrollTop이 정확히 0은 아니다 —
    // 각주 자리에서 크게 되돌아왔는지를 본다.
    await waitFor(() => expect(pane.scrollTop).toBeLessThan(atFootnote / 2));
  });

  it("목차 링크(헤딩 앵커)로 이동한다 — 각주만 되는 반쪽이 아니다", async () => {
    openTabWith(`[결론으로](#결론)\n\n${FILLER}\n\n## 결론\n\n끝.`);
    const { container } = render(<PreviewPane />);
    const pane = mountPane(container);

    await clickLinkByText(container, "결론으로");
    await waitFor(() => expect(pane.scrollTop).toBeGreaterThan(0));
  });

  it("앵커 이동이 에디터에도 전달된다 — 소스도 그 자리로 간다", async () => {
    const received: number[] = [];
    subscribeScroll("editor", (position) => received.push(position.line));
    openTabWith(`본문[^1]\n\n${FILLER}\n\n[^1]: 각주 내용`);
    const { container } = render(<PreviewPane />);
    mountPane(container);

    await clickLink(container, "sup a");
    // 에코 가드를 경유하면 발행이 막혀 에디터가 따라오지 못한다 — 그 회귀를 여기서 잡는다.
    await waitFor(() => expect(received.length).toBeGreaterThan(0));
  });

  it("끊긴 앵커는 조용한 무동작이다 — 웹뷰는 여전히 막는다", async () => {
    openTabWith(`[없는 곳](#없음)\n\n${FILLER}`);
    const { container } = render(<PreviewPane />);
    const pane = mountPane(container);

    const notCanceled = await clickLinkByText(container, "없는 곳");
    expect(notCanceled).toBe(false);
    expect(pane.scrollTop).toBe(0);
  });

  it("프리뷰 밖의 같은 id는 잡지 않는다 — 앱 UI를 스크롤하지 않는다", async () => {
    // 문서 전체(document.querySelector)에서 찾으면 앱 UI의 같은 id를 잡는다.
    // 미끼는 패널보다 **아래쪽**(top: 5000px)에 절대배치한다 — 패널 위쪽에 두면 전역
    // 탐색으로 잘못 구현해도 목표 scrollTop이 음수→0 클램프되어 이 테스트가 공허해진다
    // (변이 검증으로 확인한 함정 — 이 프로젝트에서 세 번째다).
    const decoy = document.createElement("div");
    decoy.id = "결론";
    decoy.style.cssText = "position:absolute; top:5000px; height:10px";
    document.body.append(decoy);
    try {
      openTabWith(`[결론으로](#결론)\n\n${FILLER}`); // 문서 안에는 그 헤딩이 없다
      const { container } = render(<PreviewPane />);
      const pane = mountPane(container);

      await clickLinkByText(container, "결론으로");
      expect(pane.scrollTop).toBe(0);
    } finally {
      // 실패해도 미끼를 남기지 않는다 — 남으면 다음 테스트의 앵커가 미끼에 걸린다.
      decoy.remove();
    }
  });
});
