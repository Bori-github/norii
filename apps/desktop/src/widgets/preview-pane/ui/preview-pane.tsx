import { type MouseEvent, useRef } from "react";
import { css } from "styled-system/css";

import { useDocumentStore } from "@entities/document";
import { openExternalLink } from "@features/open-link";
import { STRINGS } from "@shared/config";

import { usePreviewHtml } from "../model/use-preview-html";
import { usePreviewScrollSync } from "../model/use-preview-scroll-sync";

// 프리뷰면은 종이다 — 편집면과 같은 불투명 표면을 공유한다(→ design/decisions/0001).
// 유리(투명 창)가 켜져 있으므로 bg.canvas를 쓰면 본문 뒤로 바탕화면이 비친다.
const paneClass = css({
  flex: 1,
  minWidth: 0,
  overflowY: "auto",
  paddingX: "6",
  paddingTop: "4",
  // 바닥 여백 — 에디터의 scrollPastEnd(마지막 줄을 상단까지)와 감각을 맞춘 큰 여백.
  // 마지막 블록이 바닥에 붙지 않고, 문서의 끝이라는 신호가 된다(VS Code 프리뷰 관례).
  paddingBottom: "70vh",
  borderLeftWidth: "1px",
  borderColor: "border",
  background: "bg.paper",
  // CSS 격리 — 문서 인라인 스타일(position:fixed 등)이 패널 밖 앱 UI 위에 그려지는 것을
  // 차단한다(→ preview-strategy.md의 DOMPurify 정책).
  contain: "paint",
  // 키보드 포커스 링 — 앱의 다른 포커스 가능한 면과 같은 관례(액센트는 비텍스트라 허용,
  // → design/decisions/0005).
  _focusVisible: { outline: "2px solid", outlineColor: "accent", outlineOffset: "-2px" },
  // 프리뷰 타이포그래피 — 마크다운 블록의 최소 가독 스타일(시맨틱 토큰만 참조).
  // 헤딩은 6단계가 서로 구별돼야 한다 — h4~h6이 본문과 같으면 위계가 무너진다.
  "& h1": { fontSize: "2xl", fontWeight: "bold", marginY: "3" },
  "& h2": { fontSize: "xl", fontWeight: "bold", marginY: "3" },
  "& h3": { fontSize: "lg", fontWeight: "bold", marginY: "2" },
  "& h4": { fontSize: "md", fontWeight: "bold", marginY: "2" },
  "& h5": { fontSize: "sm", fontWeight: "bold", marginY: "2" },
  "& h6": { fontSize: "sm", fontWeight: "semibold", color: "text.muted", marginY: "2" },
  "& p": { marginY: "2", lineHeight: "relaxed" },
  "& ul, & ol": { paddingLeft: "6", marginY: "2" },
  "& ul": { listStyleType: "disc" },
  "& ol": { listStyleType: "decimal" },
  "& li.task-list-item": { listStyleType: "none", marginLeft: "-6" },
  // 코드 블록은 종이 위의 옅은 틴트다 — bg.canvas는 유리에서 투명해지므로 쓰지 않는다.
  // 전용 토큰이 없어 상태 배경(bg.hover)을 빌린다(→ 열린 결정: 프리뷰 코드면 토큰).
  "& pre": { bg: "bg.hover", padding: "3", borderRadius: "md", overflowX: "auto", marginY: "2" },
  "& code": { fontFamily: "editor", fontSize: "sm" },
  // 인라인 코드도 문장 속에서 구별돼야 한다 — 블록과 같은 틴트를 옅게 두른다.
  // 펜스 안의 code는 이미 블록이 배경을 가지므로 제외한다.
  "& :not(pre) > code": {
    bg: "bg.hover",
    paddingX: "1",
    paddingY: "0.5",
    borderRadius: "sm",
  },
  "& blockquote": {
    borderLeftWidth: "3px",
    borderColor: "border",
    paddingLeft: "3",
    color: "text.muted",
    marginY: "2",
  },
  // 넓은 표는 패널 전체가 아니라 표만 가로 스크롤한다(코드 블록과 동일한 처리).
  "& table": {
    borderCollapse: "collapse",
    marginY: "2",
    display: "block",
    overflowX: "auto",
    maxWidth: "100%",
  },
  "& th, & td": { borderWidth: "1px", borderColor: "border", paddingX: "3", paddingY: "1" },
  // 링크는 액센트가 아니라 마크 글자색이다 — 액센트를 글자에 쓰지 않는다(→ decisions/0005).
  // 프리뷰의 유일한 상호작용 요소이므로 가리킴·포커스에 반응한다.
  "& a": {
    color: "text.mark",
    textDecoration: "underline",
    textUnderlineOffset: "2px",
    _hover: { textDecorationThickness: "2px" },
    _focusVisible: { outline: "2px solid", outlineColor: "accent", outlineOffset: "2px" },
  },
  "& hr": { borderColor: "border", marginY: "4" },
  "& img": { maxWidth: "100%" },
});

// 읽기 좋은 행 길이 — 창을 넓혀도 한 줄이 무한정 길어지지 않게 본문 폭을 제한한다.
// 패널 자체는 넓게 두고(배경·경계선), 글만 가운데로 모은다.
const contentClass = css({
  maxWidth: "72ch",
  marginX: "auto",
});

// 링크 클릭 — 웹뷰 내비게이션은 **항상** 막는다(앱 창이 문서 속 URL로 이동하면 앱 UI가
// 사라진다). 그중 안전한 스킴만 OS 기본 브라우저로 넘긴다(→ preview-strategy.md 링크 정책).
function handleLinkClick(event: MouseEvent<HTMLDivElement>): void {
  const anchor = (event.target as Element).closest("a[href]");
  if (!anchor) {
    return;
  }
  event.preventDefault();
  openExternalLink(anchor.getAttribute("href") ?? "");
}

// 프리뷰 패널 — 활성 탭의 마크다운을 분할로 렌더한다(→ preview-strategy.md).
// HTML은 packages/markdown이 DOMPurify sanitize까지 마친 것이다 — 이 위젯의 책임은
// DOM 삽입과 갱신 타이밍(디바운스)뿐이다.
export function PreviewPane() {
  const activeTabId = useDocumentStore((state) => state.activeTabId);
  const html = usePreviewHtml(activeTabId);
  const paneRef = useRef<HTMLDivElement>(null);
  // html은 캐시 무효화 신호 — 렌더 스왑마다 블록 위치를 다시 잰다.
  usePreviewScrollSync(paneRef, activeTabId, html);

  if (activeTabId === null) {
    return null;
  }
  return (
    // 스크롤되는 독립 영역 — 키보드로 포커스해 방향키로 읽을 수 있고, 스크린리더가
    // 이름으로 찾는다. 스크롤 측정(usePreviewScrollSync)의 기준도 이 요소다.
    <div
      ref={paneRef}
      className={paneClass}
      data-testid="preview-pane"
      onClick={handleLinkClick}
      tabIndex={0}
      role="region"
      aria-label={STRINGS.previewRegionLabel}
    >
      <div
        className={contentClass}
        // sanitize를 거친 HTML만 온다(위 주석) — 원시 사용자 입력을 직접 넣지 않는다.
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
