import { css } from "styled-system/css";

import { ConflictBanner, MissingFileBanner } from "@features/save-file";
import { ConfirmDialog, NoticeBanner } from "@shared/ui";
import { EditorPane } from "@widgets/editor-pane";
import { NormalizationBanner } from "@widgets/normalization-banner";
import { StatusBar } from "@widgets/status-bar";
import { TabBar } from "@widgets/tab-bar";

const pageClass = css({
  display: "flex",
  flexDirection: "column",
  height: "100%",
});

// 에디터 화면 — 탭바 + 알림/충돌 배너 + 에디터 패널.
// M3~M4에서 사이드바·프리뷰 패널이 여기 함께 배치된다(→ .claude/docs/implementation-plan.md).
export function EditorPage() {
  return (
    <div className={pageClass}>
      <TabBar />
      <NoticeBanner />
      <NormalizationBanner />
      <ConflictBanner />
      <MissingFileBanner />
      <EditorPane />
      <StatusBar />
      <ConfirmDialog />
    </div>
  );
}
