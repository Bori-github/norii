import { css } from "styled-system/css";

import { ConflictBanner, MissingFileBanner } from "@features/save-file";
import { useViewModeStore } from "@features/switch-view-mode";
import { ConfirmDialog, NoticeBanner } from "@shared/ui";
import { EditorPane } from "@widgets/editor-pane";
import { NormalizationBanner } from "@widgets/normalization-banner";
import { PreviewPane } from "@widgets/preview-pane";
import { Sidebar } from "@widgets/sidebar";
import { StatusBar } from "@widgets/status-bar";
import { TabBar } from "@widgets/tab-bar";
import { ViewModeBar } from "@widgets/view-mode-bar";

const pageClass = css({
  display: "flex",
  flexDirection: "column",
  height: "100%",
});

// 사이드바(파일 트리) | 소스(에디터) | 렌더(프리뷰) — 세 칸이 남은 높이를 나눠 가진다.
const splitClass = css({
  flex: 1,
  minHeight: 0,
  display: "flex",
});

const documentClass = css({
  flex: 1,
  minWidth: 0,
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
});

const panesClass = css({
  flex: 1,
  minHeight: 0,
  display: "flex",
});

// 숨김이지 언마운트가 아니다(→ preview-strategy.md#뷰-모드).
const paneSlotClass = css({
  flex: 1,
  minWidth: 0,
  display: "flex",
  "&[hidden]": { display: "none" },
});

// 에디터 화면 — 탭바 + 알림/충돌 배너 + 사이드바·에디터·프리뷰 패널 + 상태바.
export function EditorPage() {
  const mode = useViewModeStore((state) => state.mode);
  return (
    <div className={pageClass}>
      <TabBar />
      <NoticeBanner />
      <div className={splitClass}>
        <Sidebar />
        <div className={documentClass}>
          <NormalizationBanner />
          <ConflictBanner />
          <MissingFileBanner />
          <ViewModeBar />
          <div className={panesClass}>
            <div className={paneSlotClass} hidden={mode === "preview"}>
              <EditorPane />
            </div>
            <div className={paneSlotClass} hidden={mode === "editor"}>
              <PreviewPane />
            </div>
          </div>
        </div>
      </div>
      <StatusBar />
      <ConfirmDialog />
    </div>
  );
}
