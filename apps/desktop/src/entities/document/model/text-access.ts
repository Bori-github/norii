// 탭 본문 텍스트의 접근 지점 — CM6 EditorState는 스토어에 넣지 않으므로
// (→ .claude/docs/document-model.md#상태-구조), 에디터 위젯이 핸들을 등록하고
// features(저장·충돌 해소)가 이 모듈을 통해서만 본문을 읽고 쓴다.
// CM6 타입을 노출하지 않아 entities가 에디터 구현에 결합되지 않는다.

import { logger } from "@shared/lib";

/** 에디터 위젯이 등록하는 본문 접근 핸들. */
export interface TabTextHandle {
  getText(): string;
  /** 본문 전체 교체 — 충돌 해소의 "디스크 버전으로 되돌리기"가 쓴다. */
  setText(text: string): void;
}

const handles = new Map<string, TabTextHandle>();

// 아직 에디터가 마운트되지 않은 탭의 초기 본문. 뷰 생성 시 여기서 읽는다.
const initialTexts = new Map<string, string>();

// 본문 변경 신호 — 본문이 스토어 밖에 살아 변경이 zustand로 흐르지 않으므로,
// 프리뷰 같은 파생 뷰는 이 통로로 갱신 신호를 받는다(→ preview-strategy.md#디바운스).
// 발행자는 에디터 위젯(타이핑)과 아래 setTabText(프로그램적 교체)다.
type DocChangeListener = (tabId: string) => void;

const docChangeListeners = new Set<DocChangeListener>();

/** 본문 변경 구독. 반환값은 해제 함수. 통지 중복 억제는 구독자 책임(멱등 처리). */
export function subscribeDocChanged(listener: DocChangeListener): () => void {
  docChangeListeners.add(listener);
  return () => {
    docChangeListeners.delete(listener);
  };
}

/** 본문이 바뀌었음을 구독자에게 알린다. */
export function notifyDocChanged(tabId: string): void {
  for (const listener of docChangeListeners) {
    // 구독자 격리 — 이 통지는 타이핑(CM6 dispatch)·충돌 해소·외부 리로드 경로에서
    // 동기 호출된다. 파생 뷰(프리뷰)의 버그가 그 경로들을 깨지 않게 한다.
    try {
      listener(tabId);
    } catch (cause) {
      logger.error(`문서 변경 구독자 처리 실패: ${String(cause)}`);
    }
  }
}

export function registerTabTextHandle(tabId: string, handle: TabTextHandle): void {
  handles.set(tabId, handle);
}

export function unregisterTabTextHandle(tabId: string): void {
  handles.delete(tabId);
}

/** 탭의 현재 본문. 에디터가 마운트됐으면 라이브 텍스트, 아니면 초기 본문이다. */
export function getTabText(tabId: string): string | null {
  const handle = handles.get(tabId);
  if (handle) {
    return handle.getText();
  }
  return initialTexts.get(tabId) ?? null;
}

/** 탭의 본문을 교체한다. 에디터 미마운트면 초기 본문을 갱신한다. */
export function setTabText(tabId: string, text: string): void {
  const handle = handles.get(tabId);
  if (handle) {
    handle.setText(text);
  } else {
    initialTexts.set(tabId, text);
  }
  // 교체(충돌 해소·외부 리로드)도 변경이다 — 프리뷰가 낡은 본문을 보이지 않게 통지한다.
  notifyDocChanged(tabId);
}

export function setInitialText(tabId: string, text: string): void {
  initialTexts.set(tabId, text);
}

export function getInitialText(tabId: string): string {
  return initialTexts.get(tabId) ?? "";
}

/** 탭이 닫힐 때 본문 흔적을 정리한다. */
export function clearTabText(tabId: string): void {
  handles.delete(tabId);
  initialTexts.delete(tabId);
}

/** 테스트 전용 — 모듈 전역 레지스트리 초기화(테스트 간 상태 누적 방지). */
export function resetTabTextRegistry(): void {
  handles.clear();
  initialTexts.clear();
  docChangeListeners.clear();
}
