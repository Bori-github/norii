import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { remote } from "webdriverio";
import { afterAll, beforeAll, expect, it } from "vitest";

// M1 실전 시나리오 — 위험 영역(데이터 유실 왕복)을 실제 앱 + 실제 Rust IPC로 끝단까지 검증한다
// (→ .claude/docs/testing.md#위험-영역은-실제-앱으로-검증-핵심).
//
// 왜 이 형태인가:
// - 파일 열기는 window.noriiE2e(dev 전용 E2E 훅)로 트리거한다 — WebDriver는 네이티브
//   다이얼로그를 열 수 없다. 허용 루트는 NORII_E2E_SCOPE_ROOT(mise dev-webdriver가 주입)다.
// - 타이핑은 element.addValue()만 실제 insertText로 전달된다(browser.keys는 CM6에 닿지 않음).
// - 단축키(Cmd+S 등)는 이 플러그인이 수정자 키를 합성하지 못해 여기서 검증하지 않는다 —
//   수동 검증 대상(→ testing.md#성숙도-주의).
// 경계: 인코딩 변환·watch(M2), 한글 IME 조합(M5 QA)은 이 파일의 범위 밖이다.
//
// 순서 주의: 마지막 시나리오(종료 방어)는 앱을 실제로 종료시킨다 — 반드시 이 파일의
// 마지막 테스트여야 하고, 파일 순서도 사전순 마지막이어야 한다(vitest fileParallelism=false).

const SCOPE_ROOT = process.env.NORII_E2E_SCOPE_ROOT ?? "/tmp/norii-e2e";
const WEBDRIVER_PORT = Number(process.env.TAURI_WEBDRIVER_PORT ?? "4445");

let browser: WebdriverIO.Browser;

beforeAll(async () => {
  await mkdir(SCOPE_ROOT, { recursive: true });
  browser = await remote({
    hostname: "127.0.0.1",
    port: WEBDRIVER_PORT,
    capabilities: {},
    logLevel: "error",
  });
  // 이전 스펙이 남긴 탭 상태를 지운다 — M1은 세션 복원이 없어 리로드가 곧 초기화다.
  await browser.execute(() => {
    location.reload();
    return null;
  });
  await (await browser.$('[data-testid="empty-state"]')).waitForExist({ timeout: 15_000 });
});

afterAll(async () => {
  // 종료 방어 시나리오가 앱을 이미 종료시켰으면 세션 정리는 실패해도 된다.
  try {
    await browser?.deleteSession();
  } catch {
    // 앱이 먼저 내려간 정상 경로.
  }
});

// execute 콜백은 항상 null을 반환한다 — 이 플러그인은 Promise·undefined 반환값을
// 직렬화하지 못한다("unsupported type"). 열기 완료는 반환값이 아니라 DOM 변화로 기다린다.
async function openInApp(filePath: string): Promise<void> {
  await browser.execute(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (p: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      void (window as any).noriiE2e.openPath(p);
      return null;
    },
    filePath,
  );
}

async function typeIntoEditor(text: string): Promise<void> {
  const content = await browser.$(".cm-content");
  await content.waitForExist({ timeout: 10_000 });
  await content.click();
  await content.addValue(text);
}

// 집행: implementation-plan.md M1 산출물 — "파일을 열고 고치면 자동 저장".
// 왜: 열기 → 편집 → 자동 저장 → 디스크 반영이 앱의 존재 이유다. 이 왕복이 깨지면 전부 무의미하다.
// 보장: 실제 Rust 커맨드로 연 파일이 편집 후 디바운스(2초) 자동 저장으로 디스크에 반영되고,
//       원본 내용이 보존되며 dirty 표시가 해제된다.
it("파일 왕복 — 열기, 편집, 자동 저장이 실제 디스크에 반영된다", async () => {
  const filePath = path.join(SCOPE_ROOT, "roundtrip.md");
  await writeFile(filePath, "# 원본 제목\n", "utf8");

  await openInApp(filePath);
  await typeIntoEditor("자동 저장 검증 문장. ");

  // 자동 저장은 타이핑 멈춤 2초 후 — 여유를 두고 디스크를 폴링한다.
  await browser.waitUntil(
    async () => (await readFile(filePath, "utf8")).includes("자동 저장 검증 문장"),
    { timeout: 15_000, interval: 500, timeoutMsg: "자동 저장이 디스크에 반영되지 않았다" },
  );
  const saved = await readFile(filePath, "utf8");
  expect(saved).toContain("# 원본 제목"); // 원본 보존 — 유실·변형 없음.

  // 저장 완료 후 dirty 표시(●)가 해제된다.
  await browser.waitUntil(
    async () => {
      const dirtyCount = await browser.execute(
        () => document.querySelectorAll('[aria-label="저장 대기"]').length,
      );
      return dirtyCount === 0;
    },
    { timeout: 5_000, timeoutMsg: "저장 후에도 dirty 표시가 남아 있다" },
  );
});

// 집행: implementation-plan.md M1 — 비UTF-8 파일은 원본을 건드리지 않고 거부(변환은 M2).
// 왜: 거부가 침묵하면 사용자는 "앱이 고장났다"고 느끼고, 거부가 안 되면 무단 변환이 일어난다.
// 보장: EUC-KR 파일을 열면 탭이 생기지 않고 안내 배너가 뜨며 파일 바이트는 그대로다.
it("M1 거부 — 비UTF-8 파일은 열리지 않고 안내가 뜨며 원본은 불변이다", async () => {
  const badPath = path.join(SCOPE_ROOT, "euckr.md");
  const originalBytes = Buffer.from([0xc7, 0xd1, 0xb1, 0xdb]); // EUC-KR "한글"
  await writeFile(badPath, originalBytes);

  const tabsBefore = await browser.execute(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => (window as any).noriiE2e.tabCount(),
  );
  await openInApp(badPath);

  const notice = await browser.$('[data-testid="notice"]');
  await notice.waitForExist({ timeout: 5_000 });
  const tabsAfter = await browser.execute(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => (window as any).noriiE2e.tabCount(),
  );
  expect(tabsAfter).toBe(tabsBefore);
  expect(Buffer.compare(await readFile(badPath), originalBytes)).toBe(0);
});

// 집행: file-lifecycle.md#종료-방어 — "종료 시 저장 대기 탭은 플러시. 데이터 유실 방지 최우선".
// 왜: 자동 저장 디바운스(2초)가 남기는 유일한 유실 창이 "타이핑 직후 즉시 종료"다.
// 보장: 편집 직후(디바운스 완료 전) 창을 닫아도 편집분이 디스크에 남는다.
// 경계: Untitled dirty의 확인 배너 경로는 세션이 함께 죽어 자동화가 어렵다 — 수동 검증 대상.
// 주의: 이 테스트는 앱을 실제로 종료시킨다 — 반드시 마지막 테스트여야 한다.
it("종료 방어 — 편집 직후 창을 닫아도 저장 대기분이 디스크에 남는다 (앱 종료)", async () => {
  const filePath = path.join(SCOPE_ROOT, "quit-defense.md");
  await writeFile(filePath, "# 종료 방어\n", "utf8");

  await openInApp(filePath);
  await typeIntoEditor("유실되면 안 되는 문장. ");

  // 디바운스(2초)를 기다리지 않고 즉시 닫는다 — 종료 방어가 플러시해야 하는 바로 그 창이다.
  await browser.execute(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).noriiE2e.closeWindow();
    return null;
  });

  // 앱이 내려가므로 WebDriver 없이 Node에서 디스크를 폴링한다.
  const deadline = Date.now() + 15_000;
  let saved = "";
  while (Date.now() < deadline) {
    saved = await readFile(filePath, "utf8");
    if (saved.includes("유실되면 안 되는 문장")) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  expect(saved).toContain("유실되면 안 되는 문장");
  expect(saved).toContain("# 종료 방어");
});
