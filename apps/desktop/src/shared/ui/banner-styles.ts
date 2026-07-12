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
  borderBottom: "1px solid",
  borderColor: "border",
  fontSize: "sm",
  whiteSpace: "pre-line",
});

// 종이 위이므로 액센트를 쓸 수 있다.
export const bannerActionClass = css({
  flexShrink: 0,
  paddingX: "2",
  paddingY: "1",
  border: "1px solid",
  borderColor: "border",
  borderRadius: "sm",
  cursor: "pointer",
  background: "transparent",
  color: "accent",
  _hover: { background: "bg.hover" },
});

export const bannerBodyClass = css({ flex: 1 });
