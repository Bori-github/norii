import { afterEach, expect, it } from "vitest";

import { resetTabTextRegistry, resetTabViewStates, setTabText } from "@entities/document";

import { createEditorController, type EditorController } from "./editor-controller";

// 왜: 뷰(EditorView)는 하나뿐이라 탭을 바꾸면 상태만 갈아끼운다. 문서·커서·undo는 그때
//     보존되지만 스크롤 위치는 DOM에 있어 함께 넘어가지 않는다 — 긴 문서 중간을 보다가
//     다른 탭을 다녀오면 맨 위로 돌아가 읽던 자리를 잃는다.
// 보장: 떠날 때의 뷰포트 상단 라인을 탭별로 기억하고, 돌아오면 그 자리로 되돌린다.
//       탭이 닫히면 그 기억도 함께 사라진다.
// 경계: 재시작을 건너 살아남는지는 세션 복원의 몫이다(→ .claude/docs/document-model.md#세션-복원).
//       라인 단위로 되돌리므로 픽셀이 정확히 같지는 않다 — 폰트·창 폭이 바뀌어도 읽던
//       라인이 상단에 오는 쪽을 택했다.

let controller: EditorController | null = null;
let host: HTMLElement | null = null;
let heightRule: HTMLStyleElement | null = null;

afterEach(() => {
  controller?.destroy();
  controller = null;
  host?.remove();
  host = null;
  heightRule?.remove();
  heightRule = null;
  resetTabTextRegistry();
  resetTabViewStates();
});

/** 스크롤이 생기도록 높이를 묶는다 — 실제 화면의 편집면 규칙과 같다(→ ui/editor-pane). */
function mount(): EditorController {
  host = document.createElement("div");
  host.style.height = "160px";
  document.body.append(host);
  heightRule = document.createElement("style");
  heightRule.textContent = ".cm-editor { height: 100% }";
  document.head.append(heightRule);
  controller = createEditorController({ parent: host, onDocChanged: () => {} });
  return controller;
}

function longDoc(lines: number): string {
  return Array.from({ length: lines }, (_, index) => `줄 ${index + 1}`).join("\n");
}

/** CM6의 측정·스크롤 반영이 한 프레임 뒤에 오므로 그 프레임을 기다린다. */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function hide(): void {
  if (host) {
    host.style.display = "none";
  }
}

function show(): void {
  if (host) {
    host.style.display = "";
  }
}

function scrollDom(): HTMLElement {
  const element = host?.querySelector<HTMLElement>(".cm-scroller");
  if (!element) {
    throw new Error("cm-scroller를 찾지 못했다 — 에디터가 마운트되지 않았다");
  }
  return element;
}

it("탭을 다녀오면 읽던 자리로 돌아온다", async () => {
  const editor = mount();
  setTabText("a", longDoc(300));
  setTabText("b", longDoc(300));

  editor.showTab("a");
  await nextFrame();
  scrollDom().scrollTop = 600;
  const left = scrollDom().scrollTop;
  // 스크롤이 실제로 생겼는지 확인한다 — 안 생기면 아래 단언이 0을 0과 비교해 늘 통과한다.
  expect(left).toBeGreaterThan(0);

  editor.showTab("b");
  await nextFrame();
  expect(scrollDom().scrollTop).toBe(0);

  editor.showTab("a");
  await nextFrame();
  // 라인 단위로 되돌리므로 한 줄 높이만큼의 오차를 허용한다.
  expect(scrollDom().scrollTop).toBeGreaterThan(left - 30);
  expect(scrollDom().scrollTop).toBeLessThan(left + 30);
});

it("편집면이 숨은 동안 옮긴 탭도 다시 보일 때 제 자리에서 시작한다", async () => {
  const editor = mount();
  setTabText("a", longDoc(300));
  setTabText("b", longDoc(300));

  editor.showTab("a");
  await nextFrame();
  scrollDom().scrollTop = 600;
  const left = scrollDom().scrollTop;
  // scroll 이벤트가 도착할 프레임을 준다 — 사람이 굴린 다음 모드를 바꾸는 순서다.
  await nextFrame();

  // 프리뷰 전용 모드 — 편집면은 display: none이라 높이가 0이 된다(→ pages/editor).
  hide();
  editor.showTab("b");
  await nextFrame();
  show();
  editor.reapplyScroll();
  await nextFrame();

  // 숨은 동안 되돌리기를 보류했다 — WebKit이 되살린 앞 탭의 픽셀 위치가 남지 않는다.
  expect(scrollDom().scrollTop).toBe(0);

  editor.showTab("a");
  await nextFrame();
  expect(scrollDom().scrollTop).toBeGreaterThan(left - 30);
  expect(scrollDom().scrollTop).toBeLessThan(left + 30);
});

it("닫힌 탭의 자리는 기억하지 않는다", async () => {
  const editor = mount();
  setTabText("a", longDoc(300));
  setTabText("b", longDoc(300));

  editor.showTab("a");
  await nextFrame();
  scrollDom().scrollTop = 600;
  editor.showTab("b");
  await nextFrame();

  editor.syncTabs(["b"]);
  setTabText("a", longDoc(300));
  editor.showTab("a");
  await nextFrame();

  expect(scrollDom().scrollTop).toBe(0);
});
