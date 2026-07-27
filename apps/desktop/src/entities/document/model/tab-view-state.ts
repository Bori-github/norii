// 탭별 뷰 위치 — 본문과 같은 이유로 스토어 밖에 산다(→ .claude/docs/document-model.md#상태-구조).
// 에디터 위젯이 탭을 떠날 때 쓰고 돌아올 때 읽는다.

/** 뷰포트 상단에 걸친 소스 라인(1-기반)과 그 라인 블록 내 진행률(0~1). */
export interface TabScroll {
  line: number;
  fraction: number;
}

/** 커서 자리 — 1-기반 줄·칸(상태바가 보이는 값과 같다). */
export interface TabCursor {
  line: number;
  column: number;
}

const scrolls = new Map<string, TabScroll>();
const cursors = new Map<string, TabCursor>();

export function setTabScroll(tabId: string, scroll: TabScroll): void {
  scrolls.set(tabId, scroll);
}

export function getTabScroll(tabId: string): TabScroll | null {
  return scrolls.get(tabId) ?? null;
}

export function setTabCursor(tabId: string, cursor: TabCursor): void {
  cursors.set(tabId, cursor);
}

export function getTabCursor(tabId: string): TabCursor | null {
  return cursors.get(tabId) ?? null;
}

export function clearTabViewState(tabId: string): void {
  scrolls.delete(tabId);
  cursors.delete(tabId);
}

/** 테스트 전용 — 모듈 전역 레지스트리 초기화(테스트 간 상태 누적 방지). */
export function resetTabViewStates(): void {
  scrolls.clear();
  cursors.clear();
}
