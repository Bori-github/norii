import { describe, expect, it } from "vitest";

import { externalUrlOf } from "./external-link";

// 집행: security.md#4-외부-링크 · preview-strategy.md 링크 정책
//
// 왜: 문서는 신뢰하지 않는 입력이다. file:이나 커스텀 스킴을 그대로 OS에 넘기면
//     악성 .md 한 줄이 클릭 한 번으로 로컬 파일을 열거나 외부 앱을 실행시킬 수 있다.
// 보장: http·https·mailto만 OS 브라우저로 넘어가고, 나머지는 전부 null(무동작)이다.
// 경계: 실제로 브라우저를 여는 것(plugin-opener 호출)은 위젯이 담당한다 — 여기서는
//       "무엇을 넘길지"의 판정만 고정한다.
describe("externalUrlOf — 외부로 넘길 링크 판정", () => {
  it("http·https는 넘긴다", () => {
    expect(externalUrlOf("https://example.com/docs")).toBe("https://example.com/docs");
    expect(externalUrlOf("http://example.com")).toBe("http://example.com/");
  });

  it("mailto는 넘긴다", () => {
    expect(externalUrlOf("mailto:someone@example.com")).toBe("mailto:someone@example.com");
  });

  it("file:은 거부한다 — 문서가 로컬 파일을 열게 하지 않는다", () => {
    expect(externalUrlOf("file:///etc/passwd")).toBeNull();
  });

  it("커스텀 스킴은 거부한다 — 외부 앱 실행·딥링크 차단", () => {
    expect(externalUrlOf("myapp://run?cmd=rm")).toBeNull();
    expect(externalUrlOf("vscode://file/etc/passwd")).toBeNull();
  });

  it("javascript:는 거부한다 — sanitize를 뚫고 온 경우의 마지막 방어", () => {
    expect(externalUrlOf("javascript:alert(1)")).toBeNull();
  });

  it("스킴 판정은 URL 파싱으로 한다 — 대소문자·공백을 섞은 위장에 속지 않는다", () => {
    expect(externalUrlOf("HTTPS://example.com")).toBe("https://example.com/");
    expect(externalUrlOf("  javascript:alert(1)")).toBeNull();
    expect(externalUrlOf("java\nscript:alert(1)")).toBeNull();
  });

  it("상대 경로·앵커는 넘기지 않는다 — 문서 내 이동은 아직 과제다", () => {
    expect(externalUrlOf("#섹션")).toBeNull();
    expect(externalUrlOf("./other.md")).toBeNull();
    expect(externalUrlOf("")).toBeNull();
  });
});
