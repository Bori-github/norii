import { Banner, BannerActions, BannerBody, Button, CloseIcon, IconButton } from "@norii/ui";

import { STRINGS } from "../config";

import { useNoticeStore } from "./notice-store";

// 알림 배너 스택 — 에러·확인 요청을 비차단으로 보여준다(네이티브 다이얼로그 금지).
export function NoticeBanner() {
  const notices = useNoticeStore((state) => state.notices);
  const dismissNotice = useNoticeStore((state) => state.dismissNotice);

  return (
    <>
      {notices.map((notice) => (
        <Banner key={notice.id} data-testid="notice">
          <BannerBody>{notice.message}</BannerBody>
          <BannerActions>
            {notice.actions?.map((action) => (
              <Button
                key={action.label}
                variant="accent"
                size="sm"
                onClick={() => {
                  dismissNotice(notice.id);
                  action.onPress();
                }}
              >
                {action.label}
              </Button>
            ))}
            <IconButton
              size="sm"
              label={STRINGS.dismissNoticeLabel}
              onClick={() => dismissNotice(notice.id)}
            >
              <CloseIcon />
            </IconButton>
          </BannerActions>
        </Banner>
      ))}
    </>
  );
}
