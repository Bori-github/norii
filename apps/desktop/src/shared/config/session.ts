// 세션 저장·복원의 시간 값 — 정책은 .claude/docs/document-model.md#세션-복원이 소유한다.

/** 저장 디바운스(ms) — 탭을 연달아 열고 닫는 동안 매번 디스크에 쓰지 않는다. */
export const SESSION_SAVE_DEBOUNCE_MS = 300;

/** 복원 상한(ms) — 탭 본문까지 읽으므로 설정 읽기보다 넉넉하다. */
export const SESSION_RESTORE_TIMEOUT_MS = 3000;

/** 종료 시 저장 플러시 상한(ms) — 답이 오지 않아도 창은 닫힌다. */
export const CLOSE_FLUSH_TIMEOUT_MS = 3000;

/** 최근 파일 상한 — 정책은 document-model.md#최근-파일이 소유한다. */
export const RECENT_FILES_LIMIT = 10;
