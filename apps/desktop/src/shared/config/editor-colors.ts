import type { EditorColors } from "@norii/editor";

// CM6 테마에 넘길 색 — **CSS 변수 참조**를 넘긴다.
//
// 왜 값이 아니라 변수인가: 값을 넘기면 테마를 바꿀 때마다 에디터 상태를 다시 만들어야 하고,
// 그러면 되돌리기 히스토리·커서 위치가 날아간다. 변수를 넘기면 루트의 data-theme이 바뀔 때
// 브라우저가 알아서 다시 풀어 준다 — 에디터는 아무것도 모른 채 색만 갈아입는다.
//
// 변수 이름은 Panda가 시맨틱 토큰에서 생성한다(colors.bg.paper → --colors-bg-paper).
// 값의 단일 출처는 panda.config.ts이고, 이 파일은 이름만 잇는다.
export const EDITOR_COLORS: EditorColors = {
  paper: "var(--colors-bg-paper)",
  text: "var(--colors-text)",
  muted: "var(--colors-text-muted)",
  mark: "var(--colors-text-mark)",
  accent: "var(--colors-accent)",
  hover: "var(--colors-bg-hover)",
  selection: "var(--colors-bg-selection)",
  match: "var(--colors-bg-match)",
  border: "var(--colors-border)",
};
