#!/usr/bin/env node
// E2E는 앱의 저장된 상태에서 출발하면 안 된다 — 이 맥에 남은 설정이 결과를 바꾼다.
// 실행 규칙은 .claude/docs/testing.md가 소유한다.
import { readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const { identifier } = JSON.parse(readFileSync("apps/desktop/src-tauri/tauri.conf.json", "utf8"));

const base =
  process.platform === "darwin"
    ? path.join(os.homedir(), "Library", "Application Support")
    : process.platform === "win32"
      ? (process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming"))
      : (process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config"));

for (const name of ["settings.json", "session.json"]) {
  rmSync(path.join(base, identifier, name), { force: true });
}
console.log(`앱 상태 초기화: ${path.join(base, identifier)}`);
