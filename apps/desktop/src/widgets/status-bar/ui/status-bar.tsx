import { css } from "styled-system/css";

import { useDocumentStore } from "@entities/document";
import { useEditorStatusStore } from "@features/editor-status";
import { ThemeToggle } from "@features/switch-theme";
import { STRINGS } from "@shared/config";

// 상태바는 유리(크롬)다 — 창 가장자리에 닿고 뒤가 바탕화면이다(→ DESIGN.md 표면 표).
// 탭이 없어도 항상 보이므로 테마 토글의 자리로 삼는다.
const barClass = css({
  display: "flex",
  alignItems: "center",
  gap: "2",
  paddingX: "2",
  paddingY: "0.5",
  minHeight: "6",
  fontSize: "xs",
  background: "bg.chrome",
  borderTop: "1px solid",
  borderColor: "border",
});

const fileClass = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "1",
  minWidth: 0,
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
});

// 갱신되는 숫자가 흔들리지 않게 고정폭 숫자를 쓴다.
const metricsClass = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "3",
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
          {activeTab.isDirty && <span aria-label={STRINGS.dirtyIndicatorLabel}>●</span>}
          {activeTab.title}
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
        <ThemeToggle />
      </span>
    </div>
  );
}
