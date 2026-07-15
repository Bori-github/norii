import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 복사 버튼의 "가리킬 때만 보인다"는 CSS가 있어야 성립한다(→ preview-pane.browser.test와 동일).
import "@app/index.css";

import { resetTabTextRegistry, setTabText, useDocumentStore } from "@entities/document";
import { resetScrollSync } from "@features/scroll-sync";
import { STRINGS } from "@shared/config";

import { PreviewPane } from "../index";

// 집행: preview-strategy.md#코드-복사-버튼 — 버튼은 파서가 아니라 소비 측이 프리뷰 DOM에
// 붙이는 UI다. `.md`는 바뀌지 않고, 렌더 스왑마다 사라지므로 다시 붙이며, 복사는 웹 표준
// 클립보드 API + execCommand 폴백으로 한다(Tauri 플러그인 없음).
//
// 왜: 프리뷰의 코드 블록은 드래그로 긁으면 경계를 놓치기 쉽다 — 버튼 하나로 원문 전체가
//     정확히 클립보드에 들어가야 한다.
// 보장: 코드 블록마다 버튼이 붙고, 누르면 **코드 원문**(렌더 장식 없이)이 클립보드에 들어가며,
//       클립보드 API가 없는 환경(비 secure context)에서도 폴백으로 복사된다.
//       재렌더가 버튼을 지워도 다시 붙는다. 버튼은 스크롤 매핑을 오염시키지 않는다.
// 경계: 배포 빌드(tauri:// origin)의 실동작은 자동 검증 불가 — 수동 검증 대상이다
//       (→ preview-strategy.md). 버튼의 시각 배치(오른쪽 위)는 예시 문서·수동 확인의 몫이다.

// navigator.clipboard는 테스트 러너 환경에 따라 있을 수도 없을 수도 있다 — 각 테스트가
// 명시적으로 갈아끼우고, 원래 상태로 되돌린다.
const originalClipboard = Object.getOwnPropertyDescriptor(Navigator.prototype, "clipboard");

function stubClipboard(value: unknown): void {
  Object.defineProperty(navigator, "clipboard", { value, configurable: true });
}

function restoreClipboard(): void {
  // 인스턴스에 씌운 스텁을 걷어내면 프로토타입의 원래 getter가 다시 보인다.
  delete (navigator as unknown as Record<string, unknown>)["clipboard"];
  if (originalClipboard) {
    Object.defineProperty(Navigator.prototype, "clipboard", originalClipboard);
  }
}

beforeEach(() => {
  useDocumentStore.setState({ tabs: [], activeTabId: null });
  resetTabTextRegistry();
  resetScrollSync();
});

afterEach(() => {
  restoreClipboard();
  vi.restoreAllMocks();
  cleanup();
});

function openTabWith(text: string): string {
  const id = useDocumentStore.getState().addUntitledTab();
  setTabText(id, text);
  return id;
}

async function findCopyButtons(
  container: HTMLElement,
  count: number,
): Promise<HTMLButtonElement[]> {
  return waitFor(() => {
    const buttons = [...container.querySelectorAll<HTMLButtonElement>("pre button")];
    expect(buttons).toHaveLength(count);
    return buttons;
  });
}

function click(element: Element): void {
  element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
}

const TWO_FENCES = "```js\nconst a = 1;\nconst b = 2;\n```\n\n```\n두 번째 블록\n```";

describe("프리뷰 — 코드 복사 버튼", () => {
  it("코드 블록마다 복사 버튼이 붙는다 — 문서 자체는 바뀌지 않는다", async () => {
    openTabWith(TWO_FENCES);
    const { container } = render(<PreviewPane />);
    const buttons = await findCopyButtons(container, 2);
    for (const button of buttons) {
      expect(button.getAttribute("aria-label")).toBe(STRINGS.copyCodeLabel);
      // 버튼의 얼굴은 아이콘이다 — 이름은 aria-label이 지고, 아이콘은 장식이다.
      expect(button.querySelector("svg")).not.toBeNull();
      expect(button.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
      // 버튼은 우리가 넣는 UI다 — 코드 원문(code 요소의 텍스트)에 섞이면 안 된다.
      expect(button.closest("pre")?.querySelector("code")?.contains(button)).toBe(false);
    }
  });

  it("버튼을 누르면 코드 블록의 원문이 클립보드에 들어간다", async () => {
    const written: string[] = [];
    stubClipboard({
      writeText: (text: string) => {
        written.push(text);
        return Promise.resolve();
      },
    });
    openTabWith(TWO_FENCES);
    const { container } = render(<PreviewPane />);
    const buttons = await findCopyButtons(container, 2);
    click(buttons[0] as HTMLButtonElement);
    // 펜스가 감싼 원문 그대로 — HTML 이스케이프·꼬리 개행 같은 렌더 흔적이 없다.
    await waitFor(() => expect(written).toEqual(["const a = 1;\nconst b = 2;"]));
    click(buttons[1] as HTMLButtonElement);
    await waitFor(() => expect(written[1]).toBe("두 번째 블록"));
  });

  it("복사가 끝나면 버튼이 잠시 체크 아이콘으로 바뀐다 — 소리 없는 버튼은 눌렸는지 알 수 없다", async () => {
    stubClipboard({ writeText: () => Promise.resolve() });
    openTabWith(TWO_FENCES);
    const { container } = render(<PreviewPane />);
    const buttons = await findCopyButtons(container, 2);
    const pressed = buttons[0] as HTMLButtonElement;
    const idleIcon = pressed.innerHTML;
    click(pressed);
    await waitFor(() => expect(pressed.dataset["copied"]).toBe("true"));
    // 아이콘이 실제로 갈렸고(복사 → 체크), 스크린리더용 이름도 함께 바뀐다.
    expect(pressed.innerHTML).not.toBe(idleIcon);
    expect(pressed.querySelector("svg")).not.toBeNull();
    expect(pressed.getAttribute("aria-label")).toBe(STRINGS.copyCodeDoneText);
    // 옆 버튼은 그대로 — 피드백은 누른 버튼에만 나타난다.
    expect((buttons[1] as HTMLButtonElement).dataset["copied"]).toBeUndefined();
    expect((buttons[1] as HTMLButtonElement).innerHTML).toBe(idleIcon);
  });

  it("클립보드 API가 거부해도 폴백으로 복사한다 — API가 '있지만 거부'가 폴백의 제1 사유다", async () => {
    // 비 secure context(배포 tauri:// origin)에서는 navigator.clipboard가 존재해도
    // writeText가 거부된다 — "부재" 분기와는 다른 경로다.
    stubClipboard({ writeText: () => Promise.reject(new Error("denied (테스트 주입)")) });
    const copied: string[] = [];
    vi.spyOn(document, "execCommand").mockImplementation((command: string) => {
      if (command === "copy") {
        copied.push(document.querySelector("textarea")?.value ?? "");
        return true;
      }
      return false;
    });
    openTabWith(TWO_FENCES);
    const { container } = render(<PreviewPane />);
    const buttons = await findCopyButtons(container, 2);
    click(buttons[0] as HTMLButtonElement);
    await waitFor(() => expect(copied).toEqual(["const a = 1;\nconst b = 2;"]));
  });

  it("복사 피드백은 잠시 뒤 원래 아이콘으로 돌아온다 — 영구 '복사됨'은 회귀다", async () => {
    stubClipboard({ writeText: () => Promise.resolve() });
    openTabWith(TWO_FENCES);
    const { container } = render(<PreviewPane />);
    const buttons = await findCopyButtons(container, 2);
    const pressed = buttons[0] as HTMLButtonElement;
    const idleIcon = pressed.innerHTML;
    click(pressed);
    await waitFor(() => expect(pressed.dataset["copied"]).toBe("true"));
    // 되돌림 타이머(1.5초)를 실시간으로 기다린다 — 타이머 유실 회귀를 잡는 값싼 방법이다.
    await waitFor(() => expect(pressed.dataset["copied"]).toBeUndefined(), { timeout: 4000 });
    expect(pressed.innerHTML).toBe(idleIcon);
    expect(pressed.getAttribute("aria-label")).toBe(STRINGS.copyCodeLabel);
  });

  it("복사가 양쪽 다 실패하면 '복사됨'이 뜨지 않는다 — 거짓 성공 표시 금지", async () => {
    stubClipboard(undefined);
    vi.spyOn(document, "execCommand").mockImplementation(() => false);
    openTabWith(TWO_FENCES);
    const { container } = render(<PreviewPane />);
    const buttons = await findCopyButtons(container, 2);
    const pressed = buttons[0] as HTMLButtonElement;
    click(pressed);
    // "안 뜬다"의 검증 — 성공 경로가 피드백을 켜고도 남을 시간을 주고 확인한다.
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(pressed.dataset["copied"]).toBeUndefined();
  });

  it("클립보드 API가 없으면 execCommand 폴백으로 복사한다 — 배포 빌드의 origin 대비", async () => {
    stubClipboard(undefined);
    const copied: string[] = [];
    vi.spyOn(document, "execCommand").mockImplementation((command: string) => {
      if (command === "copy") {
        // 폴백은 원문을 임시 textarea에 실어 selection으로 복사한다 — 그 값을 캡처한다.
        const staging = document.querySelector("textarea");
        copied.push(staging?.value ?? "");
        return true;
      }
      return false;
    });
    openTabWith(TWO_FENCES);
    const { container } = render(<PreviewPane />);
    const buttons = await findCopyButtons(container, 2);
    click(buttons[0] as HTMLButtonElement);
    await waitFor(() => expect(copied).toEqual(["const a = 1;\nconst b = 2;"]));
    // 임시 textarea는 복사 후 정리된다 — 프리뷰에 잔재를 남기지 않는다.
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("프리뷰가 다시 렌더되면 버튼도 다시 붙는다 — innerHTML 교체가 버튼을 지우기 때문이다", async () => {
    const tabId = openTabWith("```\n처음\n```");
    const { container } = render(<PreviewPane />);
    await findCopyButtons(container, 1);
    setTabText(tabId, "```\n바뀐 내용\n```\n\n```\n블록 추가\n```");
    await findCopyButtons(container, 2);
  });

  it("버튼은 스크롤 매핑을 오염시키지 않는다 — 라인 꼬리표가 없다", async () => {
    openTabWith(TWO_FENCES);
    const { container } = render(<PreviewPane />);
    const buttons = await findCopyButtons(container, 2);
    for (const button of buttons) {
      expect(button.hasAttribute("data-source-line")).toBe(false);
    }
  });

  it("버튼은 코드 블록을 가리킬 때만 보인다 — 읽는 동안에는 화면에 없다", async () => {
    openTabWith(TWO_FENCES);
    const { container } = render(<PreviewPane />);
    const buttons = await findCopyButtons(container, 2);
    // 가리키기 전에는 투명하다(CSS). hover 시 보이는 쪽은 실 포인터가 필요해 수동·예시 확인의 몫.
    expect(getComputedStyle(buttons[0] as HTMLButtonElement).opacity).toBe("0");
  });

  it("다이어그램 자리에는 복사 버튼이 붙지 않는다 — 코드 블록이 아니다", async () => {
    openTabWith("```mermaid\ngraph TD\nA-->B\n```\n\n```\n코드\n```");
    const { container } = render(<PreviewPane />);
    await findCopyButtons(container, 1);
    expect(container.querySelector(".norii-mermaid button")).toBeNull();
  });
});
