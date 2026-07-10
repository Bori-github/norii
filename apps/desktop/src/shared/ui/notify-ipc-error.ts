import { STRINGS } from "../config";
import { isIpcError } from "../ipc";
import { logger } from "../lib";

import { useNoticeStore } from "./notice-store";

// IPC 실패를 사용자 알림 + 로그로 표면화한다 — 실패를 삼키지 않는다(→ error-handling.md).
// 로그에는 종류(kind)만 남긴다 — 경로·내용 등 민감정보를 로그에 넣지 않는 원칙.
export function notifyIpcError(title: string, error: unknown): void {
  if (isIpcError(error)) {
    logger.error(`${title} (kind=${error.kind})`);
    useNoticeStore.getState().pushNotice(`${title} — ${STRINGS.errorKindMessages[error.kind]}`);
    return;
  }
  logger.error(`${title} (unknown error)`);
  useNoticeStore.getState().pushNotice(title);
}
