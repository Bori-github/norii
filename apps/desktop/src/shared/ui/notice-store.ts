import { create } from "zustand";

// 앱 공통 알림(배너) 상태 — 도메인 지식이 없는 표시용 프리미티브라 shared에 둔다.
// 네이티브 alert/confirm은 쓰지 않는다 — 웹뷰 이벤트 루프를 막아 E2E(WebDriver)가 멈춘다.

export interface NoticeAction {
  label: string;
  /** 버튼을 누르면 실행 — 알림은 자동으로 닫힌다. */
  onPress: () => void;
}

export interface Notice {
  id: string;
  message: string;
  actions?: NoticeAction[];
}

interface NoticeState {
  notices: Notice[];
  pushNotice(message: string, actions?: NoticeAction[]): string;
  dismissNotice(id: string): void;
}

export const useNoticeStore = create<NoticeState>()((set) => ({
  notices: [],
  pushNotice(message, actions) {
    const id = crypto.randomUUID();
    set((state) => ({
      // 같은 메시지가 이미 떠 있으면 쌓지 않는다(자동 저장 반복 실패 등).
      notices: state.notices.some((notice) => notice.message === message)
        ? state.notices
        : [...state.notices, { id, message, actions }],
    }));
    return id;
  },
  dismissNotice(id) {
    set((state) => ({ notices: state.notices.filter((notice) => notice.id !== id) }));
  },
}));
