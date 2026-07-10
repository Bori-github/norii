// 탭 본문 텍스트의 접근 지점 — CM6 EditorState는 스토어에 넣지 않으므로
// (→ .claude/docs/document-model.md#상태-구조), 에디터 위젯이 핸들을 등록하고
// features(저장·충돌 해소)가 이 모듈을 통해서만 본문을 읽고 쓴다.
// CM6 타입을 노출하지 않아 entities가 에디터 구현에 결합되지 않는다.

/** 에디터 위젯이 등록하는 본문 접근 핸들. */
export interface TabTextHandle {
  getText(): string;
  /** 본문 전체 교체 — 충돌 해소의 "디스크 버전으로 되돌리기"가 쓴다. */
  setText(text: string): void;
}

const handles = new Map<string, TabTextHandle>();

// 아직 에디터가 마운트되지 않은 탭의 초기 본문. 뷰 생성 시 여기서 읽는다.
const initialTexts = new Map<string, string>();

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
    return;
  }
  initialTexts.set(tabId, text);
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
