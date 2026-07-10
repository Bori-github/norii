import { css } from "styled-system/css";

import { useNoticeStore } from "./notice-store";

const bannerClass = css({
  display: "flex",
  alignItems: "center",
  gap: "3",
  paddingX: "4",
  paddingY: "2",
  background: "bg.surface",
  borderBottom: "1px solid",
  borderColor: "border",
  fontSize: "sm",
  whiteSpace: "pre-line",
});

const actionClass = css({
  flexShrink: 0,
  paddingX: "2",
  paddingY: "1",
  border: "1px solid",
  borderColor: "border",
  borderRadius: "sm",
  cursor: "pointer",
  background: "transparent",
  color: "accent",
  _hover: { background: "bg.canvas" },
});

// 알림 배너 스택 — 에러·확인 요청을 비차단으로 보여준다(네이티브 다이얼로그 금지).
export function NoticeBanner() {
  const notices = useNoticeStore((state) => state.notices);
  const dismissNotice = useNoticeStore((state) => state.dismissNotice);

  return (
    <>
      {notices.map((notice) => (
        <div key={notice.id} className={bannerClass} role="alert" data-testid="notice">
          <span className={css({ flex: 1 })}>{notice.message}</span>
          {notice.actions?.map((action) => (
            <button
              key={action.label}
              type="button"
              className={actionClass}
              onClick={() => {
                dismissNotice(notice.id);
                action.onPress();
              }}
            >
              {action.label}
            </button>
          ))}
          <button
            type="button"
            className={actionClass}
            aria-label="알림 닫기"
            onClick={() => dismissNotice(notice.id)}
          >
            ×
          </button>
        </div>
      ))}
    </>
  );
}
