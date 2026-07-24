// 네이티브 검증 — 실 OS 입력(AppleScript 실제 클릭)이 필요한 것만 여기서 돈다.
// 왜 E2E(WebDriver)가 아닌가: WebDriver의 합성 클릭은 네이티브 드래그 띠를 건너뛰어 "띠 통과"
// 자체를 검증하지 못한다. 실제 OS 클릭만 네이티브 층을 지난다(실측 → testing.md#성숙도-주의).
// 대가: 앱을 최상위(frontmost)로 세우고 화면 좌표에 실제 입력을 보낸다 — 실행 중 사용자가
// 마우스·키보드·창을 건드리면 어긋나 실패한다. 그래서 시작 전에 알리고, 헤드리스 CI가 아니라
// 로컬에서만 돈다(dev-webdriver 필요).
import { execFileSync } from "node:child_process";
import net from "node:net";
import process from "node:process";

import { remote } from "webdriverio";

const PORT = Number(process.env.TAURI_WEBDRIVER_PORT ?? "4445");
const WARN_SECONDS = 4;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const osa = (...lines) =>
  execFileSync("osascript", lines.flatMap((l) => ["-e", l])).toString().trim();

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port }, () => {
      socket.end();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
  });
}

// 전체화면에서 사이드바 토글이 실제 클릭에 반응하는지 — 네이티브 띠가 전체화면에서 클릭을
// 통과시켜야 눌린다(→ window-chrome.md, titlebar_drag.rs hit_test).
async function fullscreenToggleClick(browser) {
  const toggleAria = () =>
    browser.execute(
      () => document.querySelector('[data-testid="sidebar-toggle"]')?.getAttribute("aria-pressed") ?? "null",
    );
  osa(
    'tell application "System Events" to tell process "norii" to set frontmost to true',
    "delay 0.3",
    'tell application "System Events" to tell process "norii" to set value of attribute "AXFullScreen" of window 1 to true',
  );
  try {
    await sleep(2500);
    const fsFlag = await browser.execute(() => document.documentElement.dataset.fullscreen ?? "(none)");
    if (fsFlag !== "on") {
      return { ok: false, detail: `data-fullscreen=${fsFlag} (전체화면 진입 실패)` };
    }
    const rect = await browser.execute(() => {
      const el = document.querySelector('[data-testid="sidebar-toggle"]');
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    const win = osa('tell application "System Events" to tell process "norii" to get position of window 1')
      .split(",")
      .map((s) => Number.parseInt(s.trim(), 10));
    const sx = Math.round(win[0] + rect.x);
    const sy = Math.round(win[1] + rect.y);

    const before = await toggleAria();
    osa(`tell application "System Events" to click at {${sx}, ${sy}}`);
    await sleep(800);
    const after = await toggleAria();
    return {
      ok: before !== after,
      detail: `toggle@(${sx},${sy}) aria-pressed ${before}->${after}`,
    };
  } finally {
    osa(
      'tell application "System Events" to tell process "norii" to set value of attribute "AXFullScreen" of window 1 to false',
    );
  }
}

const CHECKS = [{ name: "전체화면 토글 클릭(네이티브 띠 통과)", run: fullscreenToggleClick }];

async function main() {
  if (!(await portOpen(PORT))) {
    console.error(`✘ dev-webdriver가 실행 중이 아닙니다(127.0.0.1:${PORT}).`);
    console.error("  먼저 다른 터미널에서: mise run dev-webdriver");
    process.exit(1);
  }

  console.log("┌─ 네이티브 검증 ─────────────────────────────────────");
  console.log("│ 앱을 최상위로 세우고 실제 마우스 클릭을 보냅니다.");
  console.log("│ 끝날 때까지 마우스·키보드·창을 건드리지 마세요.");
  for (let s = WARN_SECONDS; s > 0; s--) {
    process.stdout.write(`│ 시작까지 ${s}초...\r`);
    await sleep(1000);
  }
  console.log("│ 시작합니다.                    ");
  console.log("└─────────────────────────────────────────────────────");

  const browser = await remote({ hostname: "127.0.0.1", port: PORT, capabilities: {}, logLevel: "error" });
  let failed = 0;
  try {
    await browser.execute(() => {
      location.reload();
      return null;
    });
    await (await browser.$('[data-testid="sidebar-toggle"]')).waitForExist({ timeout: 15_000 });
    for (const check of CHECKS) {
      let result;
      try {
        result = await check.run(browser);
      } catch (error) {
        result = { ok: false, detail: String(error?.message ?? error) };
      }
      if (!result.ok) {
        failed += 1;
      }
      console.log(`${result.ok ? "✔" : "✘"} ${check.name} — ${result.detail}`);
    }
  } finally {
    await browser.deleteSession().catch(() => {});
  }
  console.log(failed === 0 ? `\n✔ 네이티브 검증 통과 (${CHECKS.length})` : `\n✘ 실패 ${failed}/${CHECKS.length}`);
  process.exit(failed === 0 ? 0 : 1);
}

await main();
