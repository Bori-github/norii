// @norii/ui의 컴포넌트를 앱에 노출하는 층 — 앱은 @shared/ui로만 집는다
// (→ .claude/docs/frontend-architecture.md#모노레포-패키지와의-관계).
export * from "@norii/ui";

export { ConfirmDialog } from "./confirm-dialog";
export { useConfirmStore } from "./confirm-store";
export type { ConfirmRequest } from "./confirm-store";
export { NoticeBanner } from "./notice-banner";
export { useNoticeStore } from "./notice-store";
export type { Notice, NoticeAction } from "./notice-store";
export { notifyIpcError } from "./notify-ipc-error";
