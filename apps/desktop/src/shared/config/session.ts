// 세션 저장·복원의 시간 값 — 정책은 .claude/docs/document-model.md#세션-복원이 소유한다.

/** 저장 디바운스(ms) — 탭을 연달아 열고 닫는 동안 매번 디스크에 쓰지 않는다. */
export const SESSION_SAVE_DEBOUNCE_MS = 300;
