// 네이티브 검증 — 실 OS 입력(AppleScript·CGEvent)이 필요한 것만 여기서 돈다.
// 왜 E2E(WebDriver)가 아닌가: WebDriver의 합성 클릭/키는 네이티브 창 층을 건너뛰어 드래그 띠·창
// 이동·표준 창 버튼을 검증하지 못한다. 실제 OS 입력만 그 층을 지난다(실측 → testing.md#성숙도-주의).
// 대가: 앱을 최상위(frontmost)로 세우고 화면 좌표에 실제 입력을 보낸다 — 실행 중 사용자가
// 마우스·키보드·창을 건드리면 어긋나 실패한다. 그래서 시작 전에 알리고, 헤드리스 CI가 아니라
// 로컬에서만 돈다(dev-webdriver 필요).
//
// 담긴 체크:
// - 표준 창 버튼 세로 중앙 정렬 — 접근성으로 좌표 조회.
// - 드래그 불변식 — 띠를 끌면 창이 움직이고, 본문을 끌면 안 움직인다(CGEvent 실제 드래그).
// - 전체화면 토글 클릭 — 전체화면에서 네이티브 띠가 클릭을 통과시켜 토글이 눌린다.
import { execFileSync } from "node:child_process";
import net from "node:net";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { remote } from "webdriverio";

const PORT = Number(process.env.TAURI_WEBDRIVER_PORT ?? "4445");
const WARN_SECONDS = 4;
const STRIP_HEIGHT = 36; // titlebar_drag.rs TITLEBAR_STRIP_HEIGHT — 표준 창 버튼은 이 높이의 세로 중앙.
const DRAG_SWIFT = fileURLToPath(new URL("./native-drag.swift", import.meta.url));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const osa = (...lines) =>
  execFileSync(
    "osascript",
    lines.flatMap((l) => ["-e", l]),
  )
    .toString()
    .trim();
const nums = (s) => s.split(",").map((x) => Number.parseInt(x.trim(), 10));

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port }, () => {
      socket.end();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
  });
}

function frontmost() {
  osa(
    'tell application "System Events" to tell process "norii" to set frontmost to true',
    "delay 0.3",
  );
}
const winPosSize = () =>
  nums(
    osa(
      'tell application "System Events" to tell process "norii" to get {position, size} of window 1',
    ).replace(/[{}]/g, ""),
  );
const setPos = (x, y) =>
  osa(
    `tell application "System Events" to tell process "norii" to set position of window 1 to {${x}, ${y}}`,
  );
const drag = (x1, y1, x2, y2) =>
  execFileSync("swift", [DRAG_SWIFT, `${x1}`, `${y1}`, `${x2}`, `${y2}`]);

// A) 표준 창 버튼이 띠 높이의 세로 중앙에 있는가 — 위로 치우침 회귀 감시.
async function trafficLightCentered() {
  frontmost();
  const raw = osa(`tell application "System Events" to tell process "norii"
    set wp to position of window 1
    set out to ((item 2 of wp) as string)
    repeat with b in buttons of window 1
      set bp to position of b
      set bs to size of b
      set out to out & "|" & ((item 2 of bp) as string) & "," & ((item 2 of bs) as string)
    end repeat
    return out
  end tell`);
  const [winY, ...btns] = raw.split("|");
  if (btns.length !== 3) {
    return { ok: false, detail: `표준 창 버튼 ${btns.length}개(기대 3)` };
  }
  const centers = btns.map((b) => {
    const [top, h] = nums(b);
    return top - Number(winY) + h / 2;
  });
  const target = STRIP_HEIGHT / 2;
  const ok = centers.every((c) => Math.abs(c - target) <= 4);
  return {
    ok,
    detail: `버튼 중앙 y=${centers.map((c) => c.toFixed(1)).join("/")} (띠 중앙 ${target})`,
  };
}

// B) 드래그 불변식 — 띠는 창을 끌고, 본문은 안 끈다(setMovableByWindowBackground 지뢰 감시).
async function windowDragInvariant() {
  frontmost();
  setPos(300, 200);
  await sleep(400);
  const [x0, y0, w, h] = winPosSize();
  const cx = x0 + Math.round(w / 2);

  // 띠(세로 중앙) 드래그 → 창이 끌린다. 합성 드래그는 창을 살짝 지연시키므로 정확한 델타가 아니라
  // "그 방향으로 충분히 움직였나"를 본다 — 불변식은 "움직인다 vs 안 움직인다"이지 정밀 추적이 아니다.
  drag(cx, y0 + STRIP_HEIGHT / 2, cx + 130, y0 + STRIP_HEIGHT / 2 + 130);
  await sleep(500);
  const [sx, sy] = winPosSize();
  const stripMoved = sx - x0 >= 50 && sy - y0 >= 50;

  setPos(300, 200);
  await sleep(400);
  const [bx, by] = winPosSize();

  // 본문(띠 아래 깊숙이) 드래그 → 창이 움직이면 안 된다.
  const contentY = by + Math.min(400, Math.round(h * 0.6));
  drag(cx, contentY, cx + 130, contentY + 130);
  await sleep(500);
  const [ax, ay] = winPosSize();
  const contentHeld = Math.abs(ax - bx) <= 5 && Math.abs(ay - by) <= 5;

  setPos(300, 200);
  return {
    ok: stripMoved && contentHeld,
    detail: `띠→이동 ${stripMoved ? "O" : "X"}(Δ${sx - x0},${sy - y0}) · 본문→불변 ${contentHeld ? "O" : "X"}(${ax},${ay})`,
  };
}

// C) 전체화면 토글 클릭 — 전체화면에서 네이티브 띠가 클릭을 통과시켜야 토글이 눌린다.
async function fullscreenToggleClick(browser) {
  const toggleAria = () =>
    browser.execute(
      () =>
        document.querySelector('[data-testid="sidebar-toggle"]')?.getAttribute("aria-pressed") ??
        "null",
    );
  frontmost();
  osa(
    'tell application "System Events" to tell process "norii" to set value of attribute "AXFullScreen" of window 1 to true',
  );
  try {
    await sleep(2500);
    const fsFlag = await browser.execute(
      () => document.documentElement.dataset.fullscreen ?? "(none)",
    );
    if (fsFlag !== "on") {
      return { ok: false, detail: `data-fullscreen=${fsFlag} (전체화면 진입 실패)` };
    }
    const rect = await browser.execute(() => {
      const el = document.querySelector('[data-testid="sidebar-toggle"]');
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    const [wx, wy] = winPosSize();
    const sx = Math.round(wx + rect.x);
    const sy = Math.round(wy + rect.y);
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
    await sleep(1500);
  }
}

const CHECKS = [
  { name: "표준 창 버튼 세로 중앙 정렬", run: trafficLightCentered },
  { name: "드래그: 띠는 창 이동, 본문은 불변", run: windowDragInvariant },
  { name: "전체화면 토글 클릭(네이티브 띠 통과)", run: fullscreenToggleClick },
];

async function main() {
  if (!(await portOpen(PORT))) {
    console.error(`✘ dev-webdriver가 실행 중이 아닙니다(127.0.0.1:${PORT}).`);
    console.error("  먼저 다른 터미널에서: mise run dev-webdriver");
    process.exit(1);
  }

  console.log("┌─ 네이티브 검증 ─────────────────────────────────────");
  console.log("│ 앱을 최상위로 세우고 실제 클릭·드래그를 보냅니다.");
  console.log("│ 끝날 때까지 마우스·키보드·창을 건드리지 마세요.");
  for (let s = WARN_SECONDS; s > 0; s--) {
    process.stdout.write(`│ 시작까지 ${s}초...\r`);
    await sleep(1000);
  }
  console.log("│ 시작합니다.                    ");
  console.log("└─────────────────────────────────────────────────────");

  const browser = await remote({
    hostname: "127.0.0.1",
    port: PORT,
    capabilities: {},
    logLevel: "error",
  });
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
  console.log(
    failed === 0
      ? `\n✔ 네이티브 검증 통과 (${CHECKS.length})`
      : `\n✘ 실패 ${failed}/${CHECKS.length}`,
  );
  process.exit(failed === 0 ? 0 : 1);
}

await main();
