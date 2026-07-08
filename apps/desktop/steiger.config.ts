import fsd from "@feature-sliced/steiger-plugin";
import { defineConfig } from "steiger";

// FSD 아키텍처 검증 — 레이어 참조 방향·슬라이스 저결합·Public API 규칙.
// 단일 출처: .claude/docs/frontend-architecture.md
export default defineConfig([
  ...fsd.configs.recommended,
  {
    rules: {
      // editor-pane 등 패널 위젯은 초기엔 페이지 한 곳에서만 참조되지만,
      // frontend-architecture.md가 sidebar·preview-pane·tab-bar·status-bar와 함께
      // 페이지를 구성할 독립 위젯으로 규정한다(M3~M4에서 형제 위젯이 붙는다).
      // 이 "단일 참조" 경고는 로드맵상 일시적이므로 끈다.
      "fsd/insignificant-slice": "off",
    },
  },
]);
