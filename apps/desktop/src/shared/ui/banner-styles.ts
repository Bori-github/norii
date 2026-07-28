import { css } from "styled-system/css";

// 배너(알림·충돌 안내) 공용 스타일 — 단일 정의를 notice-banner와 features의 배너가 공유한다.
// 중복 정의를 두면 배너 룩 변경 시 한쪽만 고쳐져 시각 드리프트가 생긴다.

// 배너는 떠 있지 않다 — 레이아웃을 미는 in-flow 띠라 흐릴 대상도 없다. 그래서 불투명(종이)이고,
// 아래 편집면과는 경계선으로 갈린다(→ DESIGN.md 표면 표).
export const bannerClass = css({
  display: "flex",
  alignItems: "center",
  gap: "3",
  paddingX: "4",
  paddingY: "2",
  background: "bg.paper",
  borderBottomWidth: "1px",
  borderBottomStyle: "solid",
  borderBottomColor: "border",
  fontSize: "sm",
  whiteSpace: "pre-line",
});

export const bannerActionClass = css({
  flexShrink: 0,
  paddingX: "2",
  paddingY: "1",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "accent.fg",
  borderRadius: "sm",
  cursor: "pointer",
  background: "accent",
  color: "accent.fg",
  fontWeight: "medium",
  _hover: { background: "accent.hover" },
  _active: { background: "accent.pressed" },
});

export const bannerBodyClass = css({ flex: 1 });

// 사용자 개입이 필요한 배너(충돌·삭제됨)만 쓴다. 안내 배너는 기본 모습을 그대로 둔다 —
// 전부 빨갛게 하면 "빨강 = 지금 손대야 함"이 흐려진다.
export const bannerDangerClass = css({
  borderLeftWidth: "3px",
  borderLeftColor: "status.danger",
});
