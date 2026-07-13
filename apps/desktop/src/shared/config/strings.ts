// 사용자에게 보이는 문자열의 단일 저장소 — JSX에 리터럴을 흩뿌리지 않는다.
// 향후 i18n 도입 시 이 모듈만 로케일 리소스로 교체한다
// (→ .claude/docs/frontend-architecture.md#ui-문자열과-i18n-현재-미도입).
export const STRINGS = {
  // 창 상단 띠에 우리가 그리는 앱 이름 — OS 타이틀 텍스트는 끈다(→ design/window-chrome.md).
  appName: "norii",

  untitledTitle: "Untitled",
  untitledDefaultFileName: "Untitled.md",

  // 열린 문서가 없을 때 탭바가 지키는 자리(→ .claude/docs/document-model.md#빈-탭--탭바는-비지-않는다).
  newTabTitle: "새 탭",

  emptyStateTitle: "열린 문서가 없습니다",
  emptyStateHint: "⌘N 새 문서 · ⌘O 파일 열기",

  dirtyIndicatorLabel: "저장 대기",
  closeTabLabel: "탭 닫기",
  dismissNoticeLabel: "알림 닫기",
  tabListLabel: "열린 문서",

  // 프리뷰 패널은 스크롤되는 독립 영역이다 — 스크린리더가 이름으로 찾고,
  // 키보드 사용자가 포커스해 방향키로 읽을 수 있어야 한다(→ preview-strategy.md).
  previewRegionLabel: "마크다운 프리뷰",

  // 다이어그램 렌더 실패 — 문법 오류는 사용자가 고칠 수 있는 일상이라 배너로 올리지 않고
  // 그 다이어그램 자리에서만 알린다(→ preview-strategy.md#다이어그램-mermaid).
  mermaidRenderError: "다이어그램을 그릴 수 없습니다 — 문법을 확인해 주세요",

  openFailedTitle: "파일을 열 수 없습니다",
  saveFailedTitle: "저장하지 못했습니다",
  saveAsAlreadyOpenBody:
    "이미 열려 있는 파일로는 저장할 수 없습니다. 해당 파일의 탭에서 편집해 주세요.",

  // 정규화 승인 배너 — "저장 시 무엇이 바뀌는지"를 알린다 (→ file-lifecycle.md#자동-저장).
  normalizationEncodingBody: (encoding: string) =>
    `${encoding.toUpperCase()} 인코딩으로 감지되었습니다. 저장하면 UTF-8로 변환됩니다.`,
  normalizationEolBody: (eol: string) =>
    `줄바꿈이 일정하지 않습니다. 저장하면 ${eol.toUpperCase()}로 통일됩니다.`,
  normalizationApproveLabel: "저장 시 변환 허용",
  reopenEncodingLabel: "다른 인코딩으로 다시 열기",
  reopenDirtyTitle: "편집 중인 문서 다시 열기",
  reopenDirtyBody: "다시 열면 저장되지 않은 편집이 사라지고 디스크의 원본을 다시 읽습니다.",
  reopenConfirmLabel: "다시 열기",

  conflictBadgeLabel: "외부 변경 충돌 — 탭을 열어 확인하세요",
  missingBadgeLabel: "파일이 디스크에서 삭제됨 — 탭을 열어 확인하세요",
  missingFileBody:
    "이 파일이 디스크에서 삭제되었습니다. 편집 내용은 탭에 남아 있고, 자동 저장은 멈췄습니다.",
  missingFileRecreate: "저장해서 새로 생성",

  conflictTitle: "외부 변경 충돌",
  conflictBody:
    "이 파일이 밖에서 수정되었습니다. 어느 버전을 유지할까요?\n" +
    "유지하지 않은 쪽의 변경은 사라집니다.",
  conflictKeepMine: "내 편집으로 덮어쓰기",
  conflictKeepDisk: "디스크 버전으로 되돌리기",

  closeDirtyUntitledTitle: "저장되지 않은 새 문서",
  closeDirtyUntitledBody:
    "저장되지 않은 새 문서가 있습니다. 저장하지 않고 닫으면 내용이 사라집니다.",
  closeSaveFailedBody: "저장하지 못했습니다. 저장하지 않고 닫으면 마지막 편집이 사라집니다.",
  closeUnapprovedTitle: "변환 승인 대기 중인 문서",
  closeUnapprovedBody:
    "이 문서는 저장 형식 변환(인코딩·개행) 승인 전이라 자동 저장되지 않았습니다.\n" +
    "저장하지 않고 닫으면 편집한 내용이 사라집니다.",
  closeDiscardLabel: "저장하지 않고 닫기",
  closeCancelLabel: "취소",

  quitDirtyTitle: "저장되지 않은 문서",
  quitDirtyBody:
    "저장되지 않았거나 저장에 실패한 문서가 있습니다. 그래도 종료하면 내용이 사라집니다.",
  quitDiscardLabel: "저장하지 않고 종료",

  errorBoundaryTitle: "문제가 발생했습니다",
  errorBoundaryBody: "예상치 못한 오류로 화면을 표시할 수 없습니다. 앱을 다시 시작해 주세요.",

  errorKindMessages: {
    notFound: "파일을 찾을 수 없습니다.",
    permission: "권한이 없습니다.",
    conflict: "파일이 외부에서 수정되었습니다.",
    diskFull: "디스크가 가득 찼습니다.",
    encoding: "지원되지 않는 파일 형식입니다.",
    io: "파일 처리 중 오류가 발생했습니다.",
  },
  themeToDarkLabel: "다크 테마로 전환",
  themeToLightLabel: "라이트 테마로 전환",
} as const;
