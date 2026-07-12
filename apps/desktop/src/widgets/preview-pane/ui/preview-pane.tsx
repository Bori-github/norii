import { css } from "styled-system/css";

import { useDocumentStore } from "@entities/document";

import { usePreviewHtml } from "../model/use-preview-html";

// 프리뷰면은 종이다 — 편집면과 같은 불투명 표면을 공유한다(→ design/decisions/0001).
// 유리(투명 창)가 켜져 있으므로 bg.canvas를 쓰면 본문 뒤로 바탕화면이 비친다.
const paneClass = css({
  flex: 1,
  minWidth: 0,
  overflowY: "auto",
  paddingX: "6",
  paddingY: "4",
  borderLeftWidth: "1px",
  borderColor: "border",
  background: "bg.paper",
  // 프리뷰 타이포그래피 — 마크다운 블록의 최소 가독 스타일(시맨틱 토큰만 참조).
  "& h1": { fontSize: "2xl", fontWeight: "bold", marginY: "3" },
  "& h2": { fontSize: "xl", fontWeight: "bold", marginY: "3" },
  "& h3": { fontSize: "lg", fontWeight: "semibold", marginY: "2" },
  "& h4, & h5, & h6": { fontWeight: "semibold", marginY: "2" },
  "& p": { marginY: "2", lineHeight: "relaxed" },
  "& ul, & ol": { paddingLeft: "6", marginY: "2" },
  "& ul": { listStyleType: "disc" },
  "& ol": { listStyleType: "decimal" },
  "& li.task-list-item": { listStyleType: "none", marginLeft: "-6" },
  // 코드 블록은 종이 위의 옅은 틴트다 — bg.canvas는 유리에서 투명해지므로 쓰지 않는다.
  // 전용 토큰이 없어 상태 배경(bg.hover)을 빌린다(→ 열린 결정: 프리뷰 코드면 토큰).
  "& pre": { bg: "bg.hover", padding: "3", borderRadius: "md", overflowX: "auto", marginY: "2" },
  "& code": { fontFamily: "editor", fontSize: "sm" },
  "& blockquote": {
    borderLeftWidth: "3px",
    borderColor: "border",
    paddingLeft: "3",
    color: "text.muted",
    marginY: "2",
  },
  "& table": { borderCollapse: "collapse", marginY: "2" },
  "& th, & td": { borderWidth: "1px", borderColor: "border", paddingX: "3", paddingY: "1" },
  // 링크는 액센트가 아니라 마크 글자색이다 — 액센트를 글자에 쓰지 않는다(→ decisions/0005).
  "& a": { color: "text.mark", textDecoration: "underline" },
  "& hr": { borderColor: "border", marginY: "4" },
  "& img": { maxWidth: "100%" },
});

// 프리뷰 패널 — 활성 탭의 마크다운을 분할로 렌더한다(→ preview-strategy.md).
// HTML은 packages/markdown이 DOMPurify sanitize까지 마친 것이다 — 이 위젯의 책임은
// DOM 삽입과 갱신 타이밍(디바운스)뿐이다.
export function PreviewPane() {
  const activeTabId = useDocumentStore((state) => state.activeTabId);
  const html = usePreviewHtml(activeTabId);

  if (activeTabId === null) {
    return null;
  }
  return (
    <div
      className={paneClass}
      data-testid="preview-pane"
      // sanitize를 거친 HTML만 온다(위 주석) — 원시 사용자 입력을 직접 넣지 않는다.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
