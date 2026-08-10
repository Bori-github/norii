import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "@app/index.css";

import { resetTabTextRegistry, setTabText, useDocumentStore } from "@entities/document";
import { resetScrollSync } from "@features/scroll-sync";
import { STRINGS } from "@shared/config";

import { PreviewPane } from "../index";
import { BROKEN_ALT_ATTR, BROKEN_IMAGE_ATTR } from "../model/use-image-loads";

// 집행: preview-strategy.md#이미지 — 로컬 파일은 문서 폴더 기준으로 찾고 asset 프로토콜로 읽는다.
//
// 왜: 경로 해석은 packages/markdown이 하지만 **기준 폴더를 아는 것은 앱뿐**이다. 이 배선이
//     빠지면 문서 옆 이미지가 하나도 뜨지 않는다. 못 찾은 이미지를 그 자리에 알리는 것도
//     이 계층의 몫이다.
// 보장: 상대 경로가 활성 탭의 폴더 기준 asset URL이 되고, 경로 없는 문서(Untitled)와
//       원격 주소는 건드리지 않으며, 로드에 실패한 이미지에 표시가 남는다.
// 경계: asset URL이 실제로 파일을 읽어 오는지는 실앱 E2E가 본다 — 이 계층에 asset
//       프로토콜은 없다(아래에서 변환 함수를 목으로 바꾼다). 경로 해석 규칙은
//       packages/markdown의 image-src.test.ts가 다룬다.

// asset URL 변환은 Tauri 웹뷰 전역에 기대므로 브라우저 테스트에서는 동작하지 않는다.
// 앱이 쓰는 경계(shared/ipc)만 갈아 끼워 변환 결과의 모양을 고정한다.
vi.mock("@shared/ipc", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@shared/ipc")>()),
  assetUrl: (path: string) => `asset://localhost${encodeURI(path)}`,
}));

beforeEach(() => {
  useDocumentStore.setState({ tabs: [], activeTabId: null });
  resetTabTextRegistry();
  resetScrollSync();
});

afterEach(() => {
  cleanup();
});

/** 경로가 있는 탭을 세운다 — 저장된 문서만 상대 경로의 기준 폴더를 가진다. */
function openSavedTabWith(text: string, filePath: string): void {
  const id = useDocumentStore.getState().addUntitledTab();
  useDocumentStore.setState((state) => ({
    tabs: state.tabs.map((tab) => (tab.id === id ? { ...tab, filePath } : tab)),
  }));
  setTabText(id, text);
}

function openUntitledTabWith(text: string): void {
  const id = useDocumentStore.getState().addUntitledTab();
  setTabText(id, text);
}

async function firstImage(container: HTMLElement): Promise<HTMLImageElement> {
  return await waitFor(() => {
    const image = container.querySelector("img");
    expect(image).not.toBeNull();
    return image as HTMLImageElement;
  });
}

describe("프리뷰 이미지", () => {
  it("상대 경로를 활성 탭의 폴더 기준으로 푼다", async () => {
    openSavedTabWith("![](./사진.png)", "/vault/노트/문서.md");
    const { container } = render(<PreviewPane />);
    const image = await firstImage(container);
    expect(image.getAttribute("src")).toBe(`asset://localhost${encodeURI("/vault/노트/사진.png")}`);
  });

  it("상위로 올라가는 경로도 푼다", async () => {
    openSavedTabWith("![](../그림/사진.png)", "/vault/노트/문서.md");
    const { container } = render(<PreviewPane />);
    const image = await firstImage(container);
    expect(image.getAttribute("src")).toBe(`asset://localhost${encodeURI("/vault/그림/사진.png")}`);
  });

  // 왜: Untitled 문서에는 기준 폴더가 없다. 억지로 풀면 엉뚱한 경로를 읽으러 간다.
  it("경로 없는 문서의 상대 경로는 그대로 둔다", async () => {
    openUntitledTabWith("![](./사진.png)");
    const { container } = render(<PreviewPane />);
    const image = await firstImage(container);
    expect(image.getAttribute("src")).toBe("./%EC%82%AC%EC%A7%84.png");
  });

  it("원격 주소는 그대로 둔다", async () => {
    openSavedTabWith("![](https://example.com/사진.png)", "/vault/문서.md");
    const { container } = render(<PreviewPane />);
    const image = await firstImage(container);
    expect(image.getAttribute("src")).toBe("https://example.com/%EC%82%AC%EC%A7%84.png");
  });

  // 왜: 못 찾은 이미지는 배너가 아니라 그 자리에 알린다(수식·다이어그램 실패와 같은 원칙).
  //     브라우저는 alt를 글자로 보이지 않으므로 앱이 세우지 않으면 물음표 상자만 남는다.
  // 경계: 이 테스트의 이미지는 asset 프로토콜이 없어서 실패한다 — 실패 경로를 만드는
  //       수단일 뿐, 실앱의 성공 경로는 E2E가 본다.
  it("로드에 실패한 이미지 자리에 alt 텍스트가 선다", async () => {
    openSavedTabWith("![못 찾음](./없는-파일.png)", "/vault/문서.md");
    const { container } = render(<PreviewPane />);
    const image = await firstImage(container);
    await waitFor(() => expect(image.hasAttribute(BROKEN_IMAGE_ATTR)).toBe(true));
    const fallback = container.querySelector(`[${BROKEN_ALT_ATTR}]`);
    expect(fallback?.textContent).toBe("못 찾음");
  });

  // 왜: 설명이 없는 이미지까지 자리를 비우면 왜 안 뜨는지 알 길이 없다.
  it("설명이 없으면 못 찾았다는 한 줄이 대신 선다", async () => {
    openSavedTabWith("![](./없는-파일.png)", "/vault/문서.md");
    const { container } = render(<PreviewPane />);
    await firstImage(container);
    await waitFor(() => {
      const fallback = container.querySelector(`[${BROKEN_ALT_ATTR}]`);
      expect(fallback?.textContent).toBe(STRINGS.previewImageMissing);
    });
  });
});
