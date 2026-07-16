import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import "@app/index.css";

import { resetTabTextRegistry, setTabText, useDocumentStore } from "@entities/document";
import { resetScrollSync } from "@features/scroll-sync";

import { setMermaidImporterForTest } from "../model/use-mermaid";
import { PreviewPane } from "../index";

// 집행: preview-strategy.md#다이어그램-mermaid — 렌더 실패는 그 자리에 갇힌다.
// 이 파일은 그중 "모듈 로드 자체의 실패"를 다룬다.
//
// 왜: mermaid는 동적 청크가 많아 로드가 간헐적으로 실패한다(실측 — 브라우저 테스트를
//     직렬화한 사유와 같다). 로드 실패가 unhandled rejection으로 새면 앱 레벨 오류가
//     되고, 거부된 프로미스가 캐시되면 앱을 재시작할 때까지 모든 다이어그램이 죽는다.
// 보장: 로드가 실패해도 예외가 새지 않고(unhandled rejection이 있으면 이 테스트가
//       실패한다) 문서의 나머지는 렌더되며, 실패는 캐시되지 않아 다음 갱신이 다시
//       시도해 그린다.
// 경계: 실패 주입은 테스트 전용 로더 주입구(setMermaidImporterForTest)를 쓴다 —
//       실제 네트워크 실패의 재현이 아니라 "import가 거부됐다"의 재현이다.

beforeEach(() => {
  useDocumentStore.setState({ tabs: [], activeTabId: null });
  resetTabTextRegistry();
  resetScrollSync();
});

afterEach(() => {
  setMermaidImporterForTest(null);
  cleanup();
});

function openTabWith(text: string): string {
  const id = useDocumentStore.getState().addUntitledTab();
  setTabText(id, text);
  return id;
}

describe("프리뷰 — mermaid 로드 실패", () => {
  it("로드가 실패해도 예외가 새지 않고, 회복된 다음 갱신이 다시 시도해 그린다", async () => {
    setMermaidImporterForTest(() => Promise.reject(new Error("청크 로드 실패 (테스트 주입)")));
    const tabId = openTabWith("본문 문단\n\n```mermaid\ngraph TD\nA-->B\n```");
    const { container } = render(<PreviewPane />);

    // 문서의 나머지(본문·플레이스홀더)는 정상이다 — 실패는 다이어그램에 갇힌다.
    await waitFor(() => {
      expect(container.querySelector("p")?.textContent).toBe("본문 문단");
      expect(container.querySelector(".norii-mermaid")).not.toBeNull();
    });
    // 로드 시도가 소진될 시간을 준다 — 이 사이 unhandled rejection이 나면 테스트가 깨진다.
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(container.querySelector(".norii-mermaid svg")).toBeNull();

    // 로더가 회복되면(간헐 실패가 걷힘) 다음 본문 갱신이 처음부터 다시 시도한다 —
    // 실패가 캐시됐다면 여기서 영원히 그려지지 않는다.
    setMermaidImporterForTest(null);
    setTabText(tabId, "본문 문단\n\n```mermaid\ngraph TD\nA-->B-->C\n```");
    await waitFor(() => expect(container.querySelector(".norii-mermaid svg")).not.toBeNull(), {
      // 실제 mermaid 청크 로드가 포함된다 — 넉넉히 잡는다.
      timeout: 15_000,
    });
  });
});
