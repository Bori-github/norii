import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resetTabTextRegistry, setTabText, useDocumentStore } from "@entities/document";
import { useThemeStore } from "@entities/theme";
import { resetScrollSync } from "@features/scroll-sync";
import { STRINGS } from "@shared/config";

import { PreviewPane } from "../index";

// 집행: preview-strategy.md#다이어그램-mermaid — 파서가 낸 플레이스홀더를 클라이언트가
// SVG로 그린다. mermaid는 lazy-load하고, 디바운스 갱신마다 전부 다시 그리지 않는다.
//
// 왜: 다이어그램은 프리뷰에서 유일하게 **비동기로 도착하는** 내용이다. 그리기에 실패하거나
//     갱신마다 전부 다시 그리면 타이핑이 버벅이고, 잘못 그리면 그 자리가 빈 채로 남는다.
//     sanitize 경계도 여기서 뒤집힌다 — 원문은 정화하고, 엔진이 만든 SVG는 정화된 자리에 넣는다.
// 보장: mermaid 펜스가 SVG로 렌더되고, 문법 오류는 앱을 깨지 않고 그 자리에 알려지며,
//       다이어그램이 없는 문서는 mermaid를 아예 부르지 않고(lazy-load), 본문이 바뀌어도
//       내용이 같은 다이어그램은 다시 그리지 않는다(캐시).
// 경계: 펜스 → 플레이스홀더 변환은 packages/markdown의 몫이라 다루지 않는다. 실제 다이어그램의
//       시각적 정확도는 mermaid의 책임이지 norii의 것이 아니다.

beforeEach(() => {
  useDocumentStore.setState({ tabs: [], activeTabId: null });
  useThemeStore.setState({ preference: "light" });
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

const DIAGRAM = "```mermaid\nflowchart LR\n  A-->B\n```";

describe("프리뷰 — 다이어그램(mermaid)", () => {
  it("mermaid 펜스를 SVG로 그린다", async () => {
    openTabWith(`# 제목\n\n${DIAGRAM}`);
    const { container } = render(<PreviewPane />);
    await waitFor(
      () => {
        expect(container.querySelector(".norii-mermaid svg")).not.toBeNull();
      },
      { timeout: 10_000 },
    );
  });

  it("문법이 틀린 다이어그램은 그 자리에 알린다 — 앱이 깨지지 않는다", async () => {
    openTabWith("```mermaid\n이건 다이어그램이 아니다 {{{\n```");
    const { container } = render(<PreviewPane />);
    await waitFor(
      () => {
        expect(container.querySelector(".norii-mermaid")?.textContent).toContain(
          STRINGS.mermaidRenderError,
        );
      },
      { timeout: 10_000 },
    );
    // 원문이 화면에 노출되지 않는다 — 플레이스홀더는 오류 문구만 보여 준다.
    expect(container.querySelector("svg")).toBeNull();
  });

  it("본문이 바뀌어도 내용이 같은 다이어그램은 다시 그리지 않는다 — 같은 SVG 노드가 남는다", async () => {
    const tabId = openTabWith(`# 하나\n\n${DIAGRAM}`);
    const { container } = render(<PreviewPane />);
    await waitFor(() => expect(container.querySelector(".norii-mermaid svg")).not.toBeNull(), {
      timeout: 10_000,
    });
    const firstSvgId = container.querySelector(".norii-mermaid svg")?.getAttribute("id");
    expect(firstSvgId).toBeDefined();

    // 다이어그램 밖(헤딩)만 고친다 — 프리뷰는 다시 렌더되지만 다이어그램은 그대로여야 한다.
    setTabText(tabId, `# 둘\n\n${DIAGRAM}`);
    await waitFor(() => expect(container.querySelector("h1")?.textContent).toBe("둘"));
    await waitFor(() => expect(container.querySelector(".norii-mermaid svg")).not.toBeNull());
    // 캐시가 돌면 mermaid를 다시 태우지 않으므로 SVG의 id(렌더마다 증가)가 유지된다.
    expect(container.querySelector(".norii-mermaid svg")?.getAttribute("id")).toBe(firstSvgId);
  });

  it("문법 오류가 반복돼도 임시 노드가 쌓이지 않는다 — 렌더 실패의 뒷정리", async () => {
    // mermaid는 실패하면 렌더용 임시 노드를 문서에 남긴다. 사용자는 다이어그램을 고치는 동안
    // 계속 실패하므로(디바운스 틱마다 한 번), 뒷정리를 놓치면 노드가 조용히 쌓인다.
    const tabId = openTabWith("```mermaid\n틀린 다이어그램 {{{\n```");
    render(<PreviewPane />);
    await waitFor(() => expect(document.body.textContent).toContain(STRINGS.mermaidRenderError), {
      timeout: 10_000,
    });
    setTabText(tabId, "```mermaid\n또 틀림 }}}\n```");
    await waitFor(() => expect(document.body.textContent).toContain(STRINGS.mermaidRenderError), {
      timeout: 10_000,
    });

    const strays = [...document.querySelectorAll("[id]")].filter(
      (element) => element.id.includes("mermaid") && element.closest(".norii-mermaid") === null,
    );
    expect(strays).toHaveLength(0);
  });

  it("위조된 플레이스홀더가 뒤따르는 다이어그램을 막지 않는다 — 디코딩 실패 경계", async () => {
    // 문서는 원시 HTML을 통과시키므로(<details> 등) 사용자가 플레이스홀더를 흉내 낼 수 있다.
    // 그 값이 퍼센트 인코딩이 아니면 디코딩이 URIError를 던진다 — 그 예외가 렌더 루프를
    // 뚫고 나가면 **뒤에 오는 멀쩡한 다이어그램이 통째로 그려지지 않는다.** 실패는 그
    // 플레이스홀더 하나에 가둔다.
    openTabWith(`<div class="norii-mermaid" data-mermaid-source="%"></div>\n\n${DIAGRAM}`);
    const { container } = render(<PreviewPane />);
    await waitFor(
      () => {
        expect(container.querySelector(".norii-mermaid svg")).not.toBeNull();
      },
      { timeout: 10_000 },
    );
  });

  it("다이어그램이 없는 문서는 플레이스홀더가 없다 — mermaid를 부를 일 자체가 없다", async () => {
    // lazy-load의 전제: 훅은 플레이스홀더가 하나도 없으면 import를 시작하지 않는다.
    // "import가 실제로 일어나지 않음"은 여기서 관측할 수 없다(한 번 로드되면 모듈이 남는다) —
    // 그 절반은 빌드가 증명한다(mermaid가 별도 청크로 분리되고 초기 청크에 없다).
    openTabWith("# 제목\n\n본문뿐이다");
    const { container } = render(<PreviewPane />);
    await waitFor(() => expect(container.querySelector("h1")?.textContent).toBe("제목"));
    expect(container.querySelector(".norii-mermaid")).toBeNull();
  });
});
