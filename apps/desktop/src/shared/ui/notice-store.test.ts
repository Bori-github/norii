import { beforeEach, describe, expect, it } from "vitest";

import { useNoticeStore } from "./notice-store";

// 왜: 자동 저장이 반복 실패하면 같은 메시지가 디바운스마다 오는데, 중복 억제가 없으면
//     배너가 무한히 쌓인다. 또 중복 시 반환 id가 실제 알림을 가리키지 않으면
//     dismissNotice(id)가 조용한 no-op이 되는 함정이 생긴다.
// 보장: 같은 메시지는 한 번만 쌓이고, 반환 id는 항상 실존 알림을 가리킨다.
// 경계: 배너 렌더·액션 버튼 동작은 다루지 않는다.
describe("notice-store", () => {
  beforeEach(() => {
    useNoticeStore.setState({ notices: [] });
  });

  it("같은 메시지는 중복으로 쌓이지 않고 기존 알림의 id를 돌려준다", () => {
    const first = useNoticeStore.getState().pushNotice("저장 실패");
    const second = useNoticeStore.getState().pushNotice("저장 실패");
    expect(useNoticeStore.getState().notices).toHaveLength(1);
    expect(second).toBe(first);
    // 반환 id로 실제 해제가 가능하다 — 가짜 id 함정 방지.
    useNoticeStore.getState().dismissNotice(second);
    expect(useNoticeStore.getState().notices).toHaveLength(0);
  });

  it("해제 후에는 같은 메시지를 다시 띄울 수 있다", () => {
    const id = useNoticeStore.getState().pushNotice("저장 실패");
    useNoticeStore.getState().dismissNotice(id);
    useNoticeStore.getState().pushNotice("저장 실패");
    expect(useNoticeStore.getState().notices).toHaveLength(1);
  });
});
