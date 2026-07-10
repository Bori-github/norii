import process from "node:process";

import { remote } from "webdriverio";
import { afterAll, beforeAll, expect, it } from "vitest";

// 실앱 E2E 스모크 — tauri-plugin-webdriver의 임베디드 WebDriver(127.0.0.1:4445)에 붙는다.
//
// 왜: norii의 위험 영역(한글 IME·데이터 유실 왕복)은 실제 WKWebView + 실제 IPC에서만
//     드러난다(→ .claude/docs/testing.md#위험-영역은-실제-앱으로-검증-핵심). 이 스모크는
//     그 검증을 얹을 하네스가 실제로 동작하는지만 고정한다 — "앱이 뜨고 에디터가 렌더된다".
// 경계: 파일 왕복·IME 같은 실전 시나리오는 여기서 검증하지 않는다(M1+에서 추가).
// 전제: 개발 빌드 앱이 실행 중이어야 한다(mise run dev). 앱이 없으면 연결 단계에서 실패한다.

const WEBDRIVER_PORT = Number(process.env.TAURI_WEBDRIVER_PORT ?? "4445");

let browser: WebdriverIO.Browser;

beforeAll(async () => {
  browser = await remote({
    hostname: "127.0.0.1",
    port: WEBDRIVER_PORT,
    capabilities: {},
    logLevel: "error",
  });
});

afterAll(async () => {
  await browser?.deleteSession();
});

it("실제 앱이 뜨고 마크다운 에디터가 렌더된다 (스모크)", async () => {
  const editor = await browser.$(".cm-editor");
  await editor.waitForExist({ timeout: 15000 });
  expect(await editor.isExisting()).toBe(true);
});
