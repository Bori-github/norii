import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resetTabTextRegistry, setTabText, useDocumentStore } from "@entities/document";
import { resetScrollSync } from "@features/scroll-sync";

import { EditorPage } from "../index";

// 집행: preview-strategy.md#스크롤-동기화 — 소스↔프리뷰 스크롤 연동(양방향)과 에코 차단.
//
// 왜: 동기화가 죽으면 긴 문서에서 소스와 프리뷰가 서로 다른 곳을 보여 분할 프리뷰의
//     의미가 없어진다. 에코 차단이 깨지면 두 패널이 서로를 밀며 무한 왕복한다.
// 보장: 실제 WebKit에서 에디터 스크롤 → 프리뷰 추종, 프리뷰 스크롤 → 에디터 추종,
//       그리고 동기화 후 위치가 안정(왕복 없음)함을 고정한다.
// 경계: 픽셀 단위 정밀 정렬은 사양이 아니다(블록 단위 근사 — preview-strategy.md).
//       Panda 생성 CSS는 여기 없으므로 레이아웃(높이·overflow)은 테스트가 주입한다 —
//       시각 레이아웃 자체는 실앱(데모·수동)에서 확인한다.

// 스크롤이 생기도록 충분히 긴 문서 — 각 문단이 하나의 렌더 블록이 된다.
const LONG_DOC = Array.from({ length: 300 }, (_, index) => `${index + 1}번째 문단`).join("\n\n");

// Panda CSS 부재를 보완하는 최소 레이아웃 — 두 패널을 고정 높이 스크롤 영역으로 만든다.
const LAYOUT_CSS = `
  [data-testid="editor-pane"] { height: 400px; overflow: auto; }
  [data-testid="editor-pane"] .cm-editor { height: 100%; }
  [data-testid="preview-pane"] { height: 400px; overflow: auto; }
`;

beforeEach(() => {
  useDocumentStore.setState({ tabs: [], activeTabId: null });
  resetTabTextRegistry();
  resetScrollSync();
});

afterEach(() => {
  cleanup();
});

// 소스 1줄 = 프리뷰 큰 블록(h1) — 양쪽 높이 비율이 크게 어긋나는 문서(가장자리 스냅 검증용).
const UNEVEN_DOC = Array.from({ length: 150 }, (_, index) => `# ${index + 1}번째 제목`).join(
  "\n\n",
);

async function renderDocPage(doc: string, readySelector: string) {
  const tabId = useDocumentStore.getState().addUntitledTab();
  setTabText(tabId, doc);
  const { container } = render(
    <div style={{ height: 400 }}>
      <style>{LAYOUT_CSS}</style>
      <EditorPage />
    </div>,
  );
  const editorScroller = await waitFor(() => {
    const scroller = container.querySelector(".cm-scroller");
    expect(scroller).not.toBeNull();
    return scroller as HTMLElement;
  });
  const previewPane = await waitFor(() => {
    const pane = container.querySelector('[data-testid="preview-pane"]');
    expect(pane?.querySelector(readySelector)).not.toBeNull();
    return pane as HTMLElement;
  });
  return { editorScroller, previewPane };
}

const renderLongDocPage = () => renderDocPage(LONG_DOC, "p");
const renderUnevenDocPage = () => renderDocPage(UNEVEN_DOC, "h1");

describe("스크롤 동기화 (EditorPage 통합)", () => {
  it("에디터를 스크롤하면 프리뷰가 따라온다", async () => {
    const { editorScroller, previewPane } = await renderLongDocPage();
    expect(previewPane.scrollTop).toBe(0);

    editorScroller.scrollTop = 2000;

    await waitFor(() => {
      expect(previewPane.scrollTop).toBeGreaterThan(0);
    });
  });

  it("프리뷰를 스크롤하면 에디터가 따라온다", async () => {
    const { editorScroller, previewPane } = await renderLongDocPage();
    expect(editorScroller.scrollTop).toBe(0);

    previewPane.scrollTop = 2000;

    await waitFor(() => {
      expect(editorScroller.scrollTop).toBeGreaterThan(0);
    });
  });

  // 가장자리 스냅 — "맨 윗줄 맞추기" 규칙만으로는 양쪽 내용 높이가 달라(제목은 소스
  // 1줄이지만 프리뷰에선 큰 블록) 한쪽이 바닥에 닿아도 반대쪽 바닥이 맞지 않는다.
  // 바닥에 닿으면 반대쪽도 바닥으로 스냅한다(→ preview-strategy.md#스크롤-동기화).
  // 균일한 문단만으로는 재현되지 않아, 높이 비율이 크게 어긋나는 제목 문서로 검증한다.
  it("에디터를 맨 아래로 내리면 프리뷰도 맨 아래에 닿는다", async () => {
    const { editorScroller, previewPane } = await renderUnevenDocPage();

    editorScroller.scrollTop = editorScroller.scrollHeight;

    await waitFor(() => {
      const previewMax = previewPane.scrollHeight - previewPane.clientHeight;
      expect(previewPane.scrollTop).toBeGreaterThanOrEqual(previewMax - 1);
    });
  });

  it("프리뷰를 맨 아래로 내리면 에디터도 맨 아래에 닿는다", async () => {
    const { editorScroller, previewPane } = await renderUnevenDocPage();
    // 렌더 스왑 억제 창(150ms)을 지나서 스크롤한다 — 바닥 스크롤이 스왑 보정으로
    // 오인되지 않게(실사용에서 렌더 직후 즉시 바닥까지 내리는 경우는 드물다).
    await new Promise((resolve) => setTimeout(resolve, 200));

    previewPane.scrollTop = previewPane.scrollHeight;

    await waitFor(() => {
      const editorMax = editorScroller.scrollHeight - editorScroller.clientHeight;
      expect(editorScroller.scrollTop).toBeGreaterThanOrEqual(editorMax - 1);
    });
  });

  it("동기화 후 위치가 안정된다 — 에코로 인한 무한 왕복이 없다", async () => {
    const { editorScroller, previewPane } = await renderLongDocPage();

    editorScroller.scrollTop = 2000;
    await waitFor(() => {
      expect(previewPane.scrollTop).toBeGreaterThan(0);
    });

    // 정착을 고정 sleep이 아니라 관측으로 판정한다 — 연속 두 번의 읽기가 같으면 정착
    // (느린 러너에서 고정 sleep은 정착 전 스냅숏을 찍어 간헐 실패한다 → testing.md).
    let lastEditor = -1;
    let lastPreview = -1;
    await waitFor(() => {
      const editorTop = editorScroller.scrollTop;
      const previewTop = previewPane.scrollTop;
      const settled = editorTop === lastEditor && previewTop === lastPreview;
      lastEditor = editorTop;
      lastPreview = previewTop;
      expect(settled).toBe(true);
    });

    // 정착 후 관측 창 동안 위치가 흔들리지 않는다 — 에코 왕복이 있으면 여기서 어긋난다.
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(editorScroller.scrollTop).toBe(lastEditor);
    expect(previewPane.scrollTop).toBe(lastPreview);
  });
});
