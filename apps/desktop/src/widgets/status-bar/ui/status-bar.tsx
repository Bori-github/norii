import { css } from "styled-system/css";

import { useDocumentStore } from "@entities/document";
import { useWorkspaceStore } from "@entities/workspace";
import { useEditorStatusStore } from "@features/editor-status";
import { STRINGS } from "@shared/config";
import { pathSegmentsWithinRoot } from "@shared/lib";

const barClass = css({
  display: "flex",
  alignItems: "center",
  gap: "4",
  paddingX: "3",
  height: "7",
  fontSize: "xs",
  background: "bg.chrome",
  borderTopWidth: "1px",
  borderTopStyle: "solid",
  borderTopColor: "border",
});

const fileClass = css({
  display: "inline-flex",
  alignItems: "center",
  minWidth: 0,
});

// 말줄임은 flex 컨테이너가 아니라 글자를 직접 담은 요소에 걸어야 동작한다.
const ellipsisClass = {
  minWidth: 0,
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
} as const;

const fileTitleClass = css(ellipsisClass);

// 자리가 모자랄 때 줄어드는 양은 flexShrink × 자기 폭으로 나눈다. 파일명과 똑같이 1이면 파일명도
// 함께 잘리므로, 폭과 무관하게 경로가 먼저 줄도록 999를 준다.
const filePathClass = css({ ...ellipsisClass, flexShrink: 999 });

// 갱신되는 숫자가 흔들리지 않게 고정폭 숫자를 쓴다.
const metricsClass = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "4",
  marginLeft: "auto",
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
});

export function StatusBar() {
  const activeTab = useDocumentStore((state) =>
    state.tabs.find((tab) => tab.id === state.activeTabId),
  );
  const rootDir = useWorkspaceStore((state) => state.rootDir);
  const cursor = useEditorStatusStore((state) => state.cursor);
  const chars = useEditorStatusStore((state) => state.chars);
  const segments = pathSegmentsWithinRoot(activeTab?.filePath ?? null, rootDir);

  return (
    <div className={barClass} data-testid="status-bar">
      {activeTab && (
        <span className={fileClass}>
          {segments.length > 0 && (
            <span className={filePathClass} data-testid="status-file-path">
              {segments.join("/")}/
            </span>
          )}
          <span className={fileTitleClass} data-testid="status-file-title">
            {activeTab.title}
          </span>
        </span>
      )}
      <span className={metricsClass}>
        {activeTab && chars !== null && (
          <span>
            {chars.toLocaleString()} {STRINGS.statusCharsSuffix}
          </span>
        )}
        {activeTab && cursor && (
          <span>
            {STRINGS.statusLinePrefix} {cursor.line}, {STRINGS.statusColumnPrefix} {cursor.column}
          </span>
        )}
      </span>
    </div>
  );
}
