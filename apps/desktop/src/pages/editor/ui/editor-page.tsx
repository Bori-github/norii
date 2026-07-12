import { css } from "styled-system/css";

import { ConflictBanner, MissingFileBanner } from "@features/save-file";
import { ConfirmDialog, NoticeBanner } from "@shared/ui";
import { EditorPane } from "@widgets/editor-pane";
import { NormalizationBanner } from "@widgets/normalization-banner";
import { PreviewPane } from "@widgets/preview-pane";
import { StatusBar } from "@widgets/status-bar";
import { TabBar } from "@widgets/tab-bar";

const pageClass = css({
  display: "flex",
  flexDirection: "column",
  height: "100%",
});

// 소스(에디터) | 렌더(프리뷰) 좌우 분할 — 두 패널이 남은 높이를 나눠 가진다.
const splitClass = css({
  flex: 1,
  minHeight: 0,
  display: "flex",
});

// 에디터 화면 — 탭바 + 알림/충돌 배너 + 에디터·프리뷰 분할 패널 + 상태바.
// M4에서 사이드바가 여기 함께 배치된다(→ .claude/docs/implementation-plan.md).
export function EditorPage() {
  return (
    <div className={pageClass}>
      <TabBar />
      <NoticeBanner />
      <NormalizationBanner />
      <ConflictBanner />
      <MissingFileBanner />
      <div className={splitClass}>
        <EditorPane />
        <PreviewPane />
      </div>
      <StatusBar />
      <ConfirmDialog />
    </div>
  );
}
