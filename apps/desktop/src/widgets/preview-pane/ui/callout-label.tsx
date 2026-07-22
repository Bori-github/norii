import { css } from "styled-system/css";

import {
  AlertTriangleIcon,
  AnnotationAlertIcon,
  InformationCircleContainedIcon,
  LightbulbIcon,
  MinusCircleContainedIcon,
} from "@shared/ui";

import { type CalloutKind, CALLOUT_ICON_CLASS } from "../model/use-callouts";

// 콜아웃 라벨 — 상자 첫 줄의 아이콘과 종류 이름이다.
// 아이콘과 이름이 한 노드인 이유는 포털이 상자 **끝**에 붙기 때문이다. 둘을 묶어 order로
// 맨 앞에 보낸다(상자를 flex로 만드는 쪽은 preview-pane.tsx). 나누면 각자 자리를 잡아야 하고,
// 둘 사이 간격도 CSS 두 곳으로 갈린다.

const CALLOUTS: Record<CalloutKind, { Icon: typeof AlertTriangleIcon; label: string }> = {
  note: { Icon: InformationCircleContainedIcon, label: "NOTE" },
  tip: { Icon: LightbulbIcon, label: "TIP" },
  important: { Icon: AnnotationAlertIcon, label: "IMPORTANT" },
  warning: { Icon: AlertTriangleIcon, label: "WARNING" },
  caution: { Icon: MinusCircleContainedIcon, label: "CAUTION" },
};

const labelClass = css({
  order: -1,
  display: "flex",
  alignItems: "center",
  gap: "1.5",
  marginBottom: "1",
  fontSize: "prose.label",
  fontWeight: "bold",
  color: "text.muted",
});

const iconClass = css({ flexShrink: 0, width: "4", height: "4" });

export function CalloutLabel({ kind }: { kind: CalloutKind }) {
  const { Icon, label } = CALLOUTS[kind];
  return (
    <span className={labelClass}>
      <span className={CALLOUT_ICON_CLASS} aria-hidden="true">
        <Icon className={iconClass} />
      </span>
      {label}
    </span>
  );
}
