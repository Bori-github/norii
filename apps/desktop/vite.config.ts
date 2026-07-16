import process from "node:process";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// Tauri 웹뷰가 접속하는 개발 서버 — 포트는 tauri.conf.json의 devUrl과 일치해야 한다.
export default defineConfig({
  // katex는 ESM 빌드로 고정한다 — CJS 빌드가 번들되면 제어 시퀀스가 전부 "정의되지 않음"이
  // 되어 모든 수식이 깨진다. 수식 플러그인이 require("katex")로 CJS를 잡는다
  // (→ .claude/docs/preview-strategy.md#수식-katex).
  // alias는 정확히 "katex"만 갈아치운다 — 접두 매칭이면 katex/dist/katex.min.css 같은
  // 하위 경로까지 망가진다.
  resolve: { alias: [{ find: /^katex$/, replacement: "katex/dist/katex.mjs" }] },
  plugins: [react(), tsconfigPaths({ projects: ["./tsconfig.app.json"] })],
  clearScreen: false,
  server: {
    // 포트는 기동 전에 mise 태스크가 골라 넘긴다(scripts/free-port.mjs) — Tauri의 devUrl과
    // 같은 값이어야 하므로 strictPort로 고정한다. 포트가 밀리면 devUrl과 어긋나 빈 창이 뜬다.
    port: Number(process.env["NORII_DEV_PORT"]) || 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
