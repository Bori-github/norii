import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { remote } from "webdriverio";
import { afterAll, beforeAll, expect, it } from "vitest";

// 파일 생명주기 E2E — 열기·자동 저장·거부·종료 방어를 실제 앱 + 실제 Rust IPC로 끝단까지
// 검증한다. 지키는 대상은 데이터 유실 방지다(정책 → .claude/docs/file-lifecycle.md,
// 방법론 → .claude/docs/testing.md#위험-영역은-실제-앱으로-검증-핵심).
//
// 왜 이 형태인가:
// - 파일 열기는 window.noriiE2e(dev 전용 E2E 훅)로 트리거한다 — WebDriver는 네이티브
//   다이얼로그를 열 수 없다. 허용 루트는 NORII_E2E_SCOPE_ROOT(mise dev-webdriver가 주입)다.
// - 타이핑은 element.addValue()만 실제 insertText로 전달된다(browser.keys는 CM6에 닿지 않음).
// - 단축키(Cmd+S 등)는 이 플러그인이 수정자 키를 합성하지 못해 여기서 검증하지 않는다 —
//   수동 검증 대상(→ testing.md#성숙도-주의). 정규화 승인도 같은 이유로 배너 버튼 경로만 탄다.
// 경계: 한글 IME 조합(M5 QA)은 이 파일의 범위 밖이다.
//
// 순서 주의: 마지막 시나리오(종료 방어)는 앱을 실제로 종료시킨다. E2E는 이 **한 파일**로
// 유지한다 — 파일 내 테스트 순서는 보장되지만 파일 간 실행 순서는 vitest가 보장하지
// 않음을 실측으로 확인했다(사전순 아님). 스모크도 이 파일의 첫 테스트다.

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

// 왜: 이후 모든 시나리오가 전제하는 하네스 동작(연결·렌더)을 가장 먼저 고정한다(M0 스모크 승계).
// 보장: 실제 앱이 뜨고 시작 화면(빈 상태)이 렌더된다.
// 경계: 기능 동작은 아래 시나리오들이 검증한다.
it("스모크 — 실제 앱이 뜨고 시작 화면(빈 상태)이 렌더된다", async () => {
  const emptyState = await browser.$('[data-testid="empty-state"]');
  await emptyState.waitForExist({ timeout: 15_000 });
  expect(await emptyState.isExisting()).toBe(true);
});

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

// "노리는 가볍고 빠른 마크다운 에디터다.\n한글 문서를 안전하게 연다.\n"의 EUC-KR 바이트 —
// 감지(chardetng)는 통계적이라 몇 글자짜리 표본은 오판한다(Rust text_encoding 테스트와 동일 표본).
const EUC_KR_SAMPLE = Buffer.from([
  0xb3, 0xeb, 0xb8, 0xae, 0xb4, 0xc2, 0x20, 0xb0, 0xa1, 0xba, 0xb1, 0xb0, 0xed, 0x20, 0xba, 0xfc,
  0xb8, 0xa5, 0x20, 0xb8, 0xb6, 0xc5, 0xa9, 0xb4, 0xd9, 0xbf, 0xee, 0x20, 0xbf, 0xa1, 0xb5, 0xf0,
  0xc5, 0xcd, 0xb4, 0xd9, 0x2e, 0x0a, 0xc7, 0xd1, 0xb1, 0xdb, 0x20, 0xb9, 0xae, 0xbc, 0xad, 0xb8,
  0xa6, 0x20, 0xbe, 0xc8, 0xc0, 0xfc, 0xc7, 0xcf, 0xb0, 0xd4, 0x20, 0xbf, 0xac, 0xb4, 0xd9, 0x2e,
  0x0a,
]);

// 집행: implementation-plan.md M2 산출물 — "EUC-KR 문서를 열어 승인 후 저장" +
//       file-lifecycle.md#인코딩-정책(변환·원본 불변)·#자동-저장(정규화 승인).
// 왜: 레거시 한글 문서의 열기→승인→UTF-8 저장이 M2 파일 강건성의 대표 사용자 시나리오다.
//     승인 전 원본 불변이 깨지면 "저장 전까지 파일은 바뀌지 않는다" 안전망 전체가 무의미하다.
// 보장: EUC-KR 파일이 변환되어 열리고 배너가 뜨며, 승인 전엔 원본 바이트가 그대로다.
//       배너 승인 + 편집 후 자동 저장이 디스크를 UTF-8로 재작성하고 배너가 해제된다.
it("인코딩 변환 — EUC-KR 문서를 열어 배너 승인 후 자동 저장이 UTF-8로 기록한다", async () => {
  const legacyPath = path.join(SCOPE_ROOT, "legacy-euckr.md");
  await writeFile(legacyPath, EUC_KR_SAMPLE);

  await openInApp(legacyPath);
  const banner = await browser.$('[data-testid="normalization-banner"]');
  await banner.waitForExist({ timeout: 10_000 });

  // 승인 전 — 변환된 본문이 보이지만 원본 바이트는 그대로다(열기만으로 불변).
  const editorText = await browser.execute(
    () => document.querySelector(".cm-content")?.textContent ?? "",
  );
  expect(editorText).toContain("한글 문서를 안전하게 연다");
  expect(Buffer.compare(await readFile(legacyPath), EUC_KR_SAMPLE)).toBe(0);

  await (await browser.$("button=저장 시 변환 허용")).click();
  await typeIntoEditor("승인 후 편집. ");

  // 승인 후 자동 저장 — 디스크가 UTF-8로 재작성된다(원문 글자 내용은 보존).
  await browser.waitUntil(
    async () => (await readFile(legacyPath, "utf8")).includes("승인 후 편집"),
    { timeout: 15_000, interval: 500, timeoutMsg: "승인 후 자동 저장이 반영되지 않았다" },
  );
  const saved = await readFile(legacyPath, "utf8");
  expect(saved).toContain("한글 문서를 안전하게 연다"); // UTF-8로 읽힌다 = 변환 완료.
  // 변환은 1회로 끝난다 — 배너가 해제된다.
  await browser.waitUntil(async () => !(await banner.isExisting()), {
    timeout: 5_000,
    timeoutMsg: "저장 후에도 정규화 배너가 남아 있다",
  });
});

// 집행: file-lifecycle.md#eol-정책 — 혼합 EOL은 열리고, 승인 후 저장이 판정 EOL로 통일한다.
// 왜: 개행 통일도 "사용자가 입력하지 않은 바이트 재작성"이라 같은 승인 관문을 지켜야 한다.
// 보장: 혼합 개행 파일이 배너와 함께 열리고, 승인+편집 후 자동 저장이 다수결 EOL(CRLF)로
//       통일해 기록한다(홀로 남은 LF 없음).
it("혼합 EOL — 배너 승인 후 자동 저장이 개행을 다수결로 통일한다", async () => {
  const mixedPath = path.join(SCOPE_ROOT, "mixed-eol.md");
  await writeFile(mixedPath, "a\r\nb\nc\r\n", "utf8"); // CRLF 2 vs LF 1 → 판정 crlf

  await openInApp(mixedPath);
  const banner = await browser.$('[data-testid="normalization-banner"]');
  await banner.waitForExist({ timeout: 10_000 });

  await (await browser.$("button=저장 시 변환 허용")).click();
  await typeIntoEditor("통일 확인. ");

  await browser.waitUntil(async () => (await readFile(mixedPath, "utf8")).includes("통일 확인"), {
    timeout: 15_000,
    interval: 500,
    timeoutMsg: "승인 후 자동 저장이 반영되지 않았다",
  });
  const saved = await readFile(mixedPath, "utf8");
  expect(saved).toContain("\r\n");
  expect(saved.replaceAll("\r\n", "")).not.toContain("\n"); // 홀로 남은 LF 없음 — 통일 완료.
});

// 집행: file-lifecycle.md#인코딩-정책 파이프라인 2단계 — 바이너리는 항상 거부, 파일 불변.
// 왜: 거부가 침묵하면 사용자는 "앱이 고장났다"고 느끼고, 거부가 안 되면 사진·프로그램이
//     깨진 텍스트로 열려 저장 시 파일이 파괴된다.
// 보장: 불규칙 널 바이트 파일은 탭이 생기지 않고 안내가 뜨며 바이트가 그대로다.
it("바이너리 거부 — 글이 아닌 파일은 열리지 않고 안내가 뜨며 원본은 불변이다", async () => {
  const badPath = path.join(SCOPE_ROOT, "binary.md");
  const originalBytes = Buffer.from([0x89, 0x50, 0x00, 0x00, 0x0d, 0x0a]);
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

// 집행: file-lifecycle.md#외부-변경-처리 — "file-changed (해당 탭이 dirty): 충돌 안내 —
//       디스크 버전 vs 편집 버전 선택" + "자동 병합은 하지 않는다".
// 왜: 충돌에서 자동 저장이 외부 수정본을 조용히 덮어쓰면 Obsidian 자동 병합 사고의 재현이다.
// 보장: 외부 수정 후 자동 저장은 디스크를 건드리지 않고 배너를 띄우며,
//       "디스크 버전으로 되돌리기"가 본문을 교체하고 배너를 해제한다.
// 경계: 감지 경로는 둘 다 유효하다(watch 이벤트·저장 시 해시 검사) — 어느 쪽이 먼저든
//       결과는 같은 충돌 배너다. 경로 구분은 유닛 테스트 소관.
it("외부 변경 충돌 — 자동 저장이 덮어쓰지 않고 배너로 선택을 받는다", async () => {
  const filePath = path.join(SCOPE_ROOT, "conflict.md");
  await writeFile(filePath, "# 충돌 원본\n", "utf8");

  await openInApp(filePath);
  await typeIntoEditor("내 편집 ");
  // 자동 저장 디바운스(2초) 안에 외부 프로세스가 같은 파일을 수정한다.
  await writeFile(filePath, "# 외부 수정본\n", "utf8");

  const banner = await browser.$('[data-testid="conflict-banner"]');
  await banner.waitForExist({ timeout: 10_000 });
  // 디스크에는 외부 수정본이 그대로다 — 자동 저장이 덮어쓰지 않았다.
  expect(await readFile(filePath, "utf8")).toBe("# 외부 수정본\n");

  await (await browser.$("button=디스크 버전으로 되돌리기")).click();
  await browser.waitUntil(
    async () => {
      const text = await browser.execute(
        () => document.querySelector(".cm-content")?.textContent ?? "",
      );
      return text.includes("외부 수정본") && !text.includes("내 편집");
    },
    { timeout: 5_000, timeoutMsg: "디스크 버전 리로드가 에디터에 반영되지 않았다" },
  );
  await browser.waitUntil(async () => !(await banner.isExisting()), {
    timeout: 5_000,
    timeoutMsg: "충돌 해소 후에도 배너가 남아 있다",
  });
});

// 집행: file-lifecycle.md#외부-변경-처리 — "file-changed (해당 탭이 dirty 아님): 조용히 리로드".
// 왜: watch → 이벤트 → 프론트 리로드의 전체 파이프라인이 실제로 이어지는지는 실앱에서만
//     확인된다(Rust watch·프론트 판정은 각자 검증됐지만 연결은 여기가 처음이다).
// 보장: 편집 중이 아닌 탭의 파일을 외부에서 수정하면 에디터 본문이 사용자 개입 없이
//       갱신되고, 충돌 배너는 뜨지 않는다.
it("외부 변경 리로드 — 편집 중이 아닌 탭은 조용히 새로고침된다", async () => {
  const filePath = path.join(SCOPE_ROOT, "silent-reload.md");
  await writeFile(filePath, "# 리로드 원본\n", "utf8");

  await openInApp(filePath);
  await browser.waitUntil(
    async () => {
      const text = await browser.execute(
        () => document.querySelector(".cm-content")?.textContent ?? "",
      );
      return text.includes("리로드 원본");
    },
    { timeout: 10_000, timeoutMsg: "파일이 에디터에 열리지 않았다" },
  );

  await writeFile(filePath, "# 외부 갱신본\n", "utf8");

  await browser.waitUntil(
    async () => {
      const text = await browser.execute(
        () => document.querySelector(".cm-content")?.textContent ?? "",
      );
      return text.includes("외부 갱신본");
    },
    { timeout: 10_000, timeoutMsg: "외부 수정이 에디터에 반영되지 않았다" },
  );
  // 편집 중이 아니었으므로 충돌이 아니다 — 배너 없이 조용해야 한다.
  expect(await (await browser.$('[data-testid="conflict-banner"]')).isExisting()).toBe(false);
});

// 집행: file-lifecycle.md#외부-변경-처리 — "file-removed: 탭에 표시, 저장 시 새로 생성 선택".
// 왜: 삭제를 놓치면 사용자는 존재하지 않는 파일을 편집하는 줄 모르고, 자동 저장이 조용히
//     되살리면 밖에서 지운 의도가 뒤집힌다 — 표시와 명시적 재생성이 그 균형이다.
// 보장: 외부 삭제 시 배너가 뜨고, "저장해서 새로 생성" 버튼이 파일을 디스크에 되살린다.
it("외부 삭제 — 배너가 뜨고 명시적 저장이 파일을 새로 생성한다", async () => {
  const filePath = path.join(SCOPE_ROOT, "removed.md");
  await writeFile(filePath, "# 삭제될 문서\n", "utf8");

  await openInApp(filePath);
  await browser.waitUntil(
    async () => {
      const text = await browser.execute(
        () => document.querySelector(".cm-content")?.textContent ?? "",
      );
      return text.includes("삭제될 문서");
    },
    { timeout: 10_000, timeoutMsg: "파일이 에디터에 열리지 않았다" },
  );

  await rm(filePath);

  const banner = await browser.$('[data-testid="missing-file-banner"]');
  await banner.waitForExist({ timeout: 10_000 });

  await (await browser.$("button=저장해서 새로 생성")).click();
  await browser.waitUntil(
    async () => {
      try {
        return (await readFile(filePath, "utf8")).includes("삭제될 문서");
      } catch {
        return false; // 아직 재생성 전.
      }
    },
    { timeout: 10_000, timeoutMsg: "재생성 저장이 디스크에 반영되지 않았다" },
  );
  await browser.waitUntil(async () => !(await banner.isExisting()), {
    timeout: 5_000,
    timeoutMsg: "재생성 후에도 삭제 배너가 남아 있다",
  });
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
