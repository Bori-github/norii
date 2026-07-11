import { beforeEach, describe, expect, it, vi } from "vitest";

import { useConfirmStore } from "./confirm-store";

// 집행: confirm-dialog의 안전 전제 — "settle이 중복 호출을 무시하므로 Esc(cancel)와
//       close가 겹쳐도 안전"이라는 주석은 이 스토어의 보장에 기대고 있다.
// 왜: 중복 settle 가드가 깨지면 확인 콜백이 두 번 실행돼 탭 닫기·종료가 이중 처리된다.
// 보장: settle은 정확히 한 번만 콜백을 실행하고, 이후 호출은 무시된다.
// 경계: <dialog> DOM 동작(showModal·cancel 이벤트)은 다루지 않는다 — 수동/E2E 대상.
function request(onConfirm = vi.fn(), onCancel = vi.fn()) {
  useConfirmStore.getState().requestConfirm({
    title: "제목",
    body: "본문",
    confirmLabel: "확인",
    cancelLabel: "취소",
    onConfirm,
    onCancel,
  });
  return { onConfirm, onCancel };
}

describe("confirm-store", () => {
  beforeEach(() => {
    useConfirmStore.setState({ pending: null });
  });

  it("settle(true)는 onConfirm만 1회 실행하고 대기 상태를 비운다", () => {
    const { onConfirm, onCancel } = request();
    useConfirmStore.getState().settle(true);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    expect(useConfirmStore.getState().pending).toBeNull();
  });

  it("중복 settle은 무시된다 — Esc(cancel)와 close 이벤트가 겹쳐도 콜백은 1회", () => {
    const { onConfirm, onCancel } = request();
    useConfirmStore.getState().settle(true);
    useConfirmStore.getState().settle(false); // 겹친 두 번째 호출
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("나중 요청이 이전 요청을 대체한다(단발성 확인 전제)", () => {
    const first = request();
    const second = request();
    useConfirmStore.getState().settle(true);
    expect(first.onConfirm).not.toHaveBeenCalled();
    expect(second.onConfirm).toHaveBeenCalledTimes(1);
  });
});
