import type { Eol } from "@shared/ipc";

/**
 * 탭 상태 — 구조의 단일 출처: .claude/docs/document-model.md#상태-구조.
 * CM6 EditorState(본문)는 스토어 밖(에디터 인스턴스)에서 관리한다.
 */
export interface Tab {
  id: string;
  /** null = 미저장 새 문서(Untitled). */
  filePath: string | null;
  /** 파일명 또는 "Untitled". */
  title: string;
  /** 자동 저장 대기 중 여부 (→ file-lifecycle.md). */
  isDirty: boolean;
  /** 감지된 원본 인코딩. 'utf-8' 아니면 변환 배너 표시 (→ file-lifecycle.md). */
  sourceEncoding: string;
  /** 원본 BOM 유무 — 저장 시 그대로 유지. */
  hasBom: boolean;
  /** 판정된 EOL. 새 문서는 'lf' (→ file-lifecycle.md). */
  eol: Eol;
  /** 원본 개행이 판정 EOL과 불일치(혼합·CR-only) — 정규화 승인 대상 (→ file-lifecycle.md). */
  eolMixed: boolean;
  /** 정규화 승인 여부 — 배너 승인·첫 수동 저장으로 true (→ file-lifecycle.md#자동-저장). */
  normalizationApproved: boolean;
  /** 열기/저장이 반환한 내용 해시 — 충돌 검사·에코 억제용 (→ file-lifecycle.md). */
  lastSavedHash: string | null;
}

/**
 * 저장이 사용자가 입력하지 않은 바이트 변경(인코딩 변환·개행 통일)을 수행하게 되는 탭인가.
 * true인 동안 자동 저장·종료 플러시·탭 닫기 플러시가 이 탭을 건드리지 않는다
 * (→ file-lifecycle.md#자동-저장 정규화 승인).
 */
export function needsNormalizationApproval(tab: Tab): boolean {
  return (tab.sourceEncoding !== "utf-8" || tab.eolMixed) && !tab.normalizationApproved;
}
