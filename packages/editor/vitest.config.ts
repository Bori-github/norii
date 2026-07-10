import { defineConfig } from "vitest/config";

// EditorState 계열은 DOM에 의존하지 않으므로 node 환경에서 검증한다.
// DOM이 필요한 EditorView·컴포넌트 검증은 앱 레이어의 브라우저 모드에서 다룬다(→ .claude/docs/testing.md).
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
