import { create } from "zustand";

// 확인 다이얼로그 상태 — 파괴적 선택(닫기·종료 시 편집 버리기)의 명시적 확인에 쓴다.
// 인앱 모달을 쓰는 이유는 file-lifecycle.md#종료-방어를 단일 출처로 둔다
// (JS confirm은 웹뷰를 블로킹, 네이티브 다이얼로그는 자동 검증 불가).

export interface ConfirmRequest {
  title: string;
  body: string;
  /** 파괴적 선택 버튼(예: "저장하지 않고 닫기"). */
  confirmLabel: string;
  cancelLabel: string;
  onConfirm(): void;
  onCancel?(): void;
}

interface ConfirmState {
  pending: ConfirmRequest | null;
  /** 확인을 요청한다. 이미 떠 있으면 나중 요청이 대체한다(단발성 확인 전제). */
  requestConfirm(request: ConfirmRequest): void;
  /** 사용자의 선택으로 다이얼로그를 닫는다 — 이후 콜백 실행. 중복 호출은 무시된다. */
  settle(confirmed: boolean): void;
}

export const useConfirmStore = create<ConfirmState>()((set, get) => ({
  pending: null,
  requestConfirm(request) {
    set({ pending: request });
  },
  settle(confirmed) {
    const { pending } = get();
    if (!pending) {
      return;
    }
    set({ pending: null });
    if (confirmed) {
      pending.onConfirm();
    } else {
      pending.onCancel?.();
    }
  },
}));
