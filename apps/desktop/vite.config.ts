import process from "node:process";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// Tauri 웹뷰가 접속하는 개발 서버 — 포트는 tauri.conf.json의 devUrl과 일치해야 한다.
export default defineConfig({
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
