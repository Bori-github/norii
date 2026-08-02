import { css } from "styled-system/css";

import { useDocumentStore } from "@entities/document";
import { useEditorStatusStore } from "@features/editor-status";
import { STRINGS } from "@shared/config";

// 상태바는 유리(크롬)다 — 창 가장자리에 닿고 뒤가 바탕화면이다(→ DESIGN.md 표면 표).
const barClass = css({
  display: "flex",
  alignItems: "center",
  gap: "4",
  paddingX: "3",
  height: "7",
  fontSize: "sm",
  background: "bg.chrome",
  borderTopWidth: "1px",
  borderTopStyle: "solid",
  borderTopColor: "border",
});

const fileClass = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "1.5",
  minWidth: 0,
});

// 말줄임은 flex 컨테이너가 아니라 글자를 직접 담은 요소에 걸어야 동작한다.
const fileTitleClass = css({
  minWidth: 0,
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
});

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
  const cursor = useEditorStatusStore((state) => state.cursor);
  const chars = useEditorStatusStore((state) => state.chars);

  return (
    <div className={barClass} data-testid="status-bar">
      {activeTab && (
        <span className={fileClass}>
          {activeTab.isDirty && (
            <span role="img" aria-label={STRINGS.dirtyIndicatorLabel}>
              ●
            </span>
          )}
          <span className={fileTitleClass}>{activeTab.title}</span>
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
