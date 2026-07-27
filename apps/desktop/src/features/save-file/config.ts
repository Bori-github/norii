// 자동 저장 간격 — 정책의 단일 출처: file-lifecycle.md#자동-저장.

/** 고를 수 있는 값. `null`은 끄기이고, 이 순서가 설정 화면의 칸 순서다. */
export const AUTOSAVE_INTERVALS_MS = [null, 5000, 10_000, 30_000, 60_000] as const;

export type AutosaveInterval = (typeof AUTOSAVE_INTERVALS_MS)[number];

export const AUTOSAVE_INTERVAL_DEFAULT_MS = 5000;

export function isAutosaveInterval(value: unknown): value is AutosaveInterval {
  return AUTOSAVE_INTERVALS_MS.includes(value as AutosaveInterval);
}
