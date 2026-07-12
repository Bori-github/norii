import { afterEach, describe, expect, it, vi } from "vitest";

import {
  notifyDocChanged,
  registerTabTextHandle,
  resetTabTextRegistry,
  setTabText,
  subscribeDocChanged,
} from "./text-access";

// 왜: 본문은 스토어 밖(CM6)에 살아서 변경이 zustand로 흐르지 않는다. 프리뷰 같은 파생
//     뷰는 "본문이 바뀌었다"는 신호를 받아야 갱신할 수 있다(→ preview-strategy.md#디바운스).
//     에디터 위젯(타이핑)과 setTabText(프로그램적 교체)가 발행하고, 파생 뷰가 구독한다.
// 보장: 구독자는 바뀐 탭의 id를 받고, 해제 후에는 더 받지 않으며, 본문 교체도 통지된다.
// 경계: 디바운스·렌더는 소비 측(프리뷰 위젯) 책임이라 다루지 않는다. 통지 순서·중복
//       억제는 보장하지 않는다 — 구독자가 멱등하게 처리한다.
describe("문서 변경 신호 (subscribeDocChanged / notifyDocChanged)", () => {
  afterEach(() => {
    resetTabTextRegistry();
  });

  it("notifyDocChanged는 구독자에게 바뀐 탭 id를 전달한다", () => {
    const listener = vi.fn();
    subscribeDocChanged(listener);
    notifyDocChanged("tab-1");
    expect(listener).toHaveBeenCalledExactlyOnceWith("tab-1");
  });

  it("구독 해제 후에는 통지받지 않는다", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeDocChanged(listener);
    unsubscribe();
    notifyDocChanged("tab-1");
    expect(listener).not.toHaveBeenCalled();
  });

  it("setTabText(본문 교체)도 변경으로 통지한다 — 충돌 해소·외부 리로드 뒤 프리뷰가 낡지 않게", () => {
    const listener = vi.fn();
    subscribeDocChanged(listener);
    // 에디터 마운트 전(초기 본문 교체)과 마운트 후(핸들 경유) 모두 통지한다.
    setTabText("tab-1", "마운트 전 교체");
    registerTabTextHandle("tab-1", { getText: () => "", setText: () => {} });
    setTabText("tab-1", "마운트 후 교체");
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenNthCalledWith(1, "tab-1");
    expect(listener).toHaveBeenNthCalledWith(2, "tab-1");
  });

  it("resetTabTextRegistry가 구독자도 정리한다 — 테스트 간 누수 방지", () => {
    const listener = vi.fn();
    subscribeDocChanged(listener);
    resetTabTextRegistry();
    notifyDocChanged("tab-1");
    expect(listener).not.toHaveBeenCalled();
  });
});
