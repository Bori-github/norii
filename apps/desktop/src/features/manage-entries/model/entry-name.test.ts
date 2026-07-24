import { describe, expect, it } from "vitest";

import { checkEntryName, defaultEntryName, withMarkdownExtension } from "./entry-name";

// 집행: rust-commands.md#항목-이름-규칙 — 프론트는 입력 중에 같은 규칙을 판정해 확정을
//       막고, 거부의 강제는 Rust가 한다.
describe("checkEntryName", () => {
  // 왜: 판정이 Rust보다 느슨하면 확정 버튼이 눌린 뒤에야 거부돼 입력이 튕기고, 더 빡빡하면
  //     Rust가 받아들이는 이름을 못 쓴다 — 두 층이 같은 답을 내야 한다.
  // 보장: 트림 후 빈 이름·'.' 시작·'/' 포함·제어문자가 각각 구분된 문제로 나온다.
  // 경계: 최종 판정은 Rust다 — 여기서 통과해도 경합으로 거부될 수 있다.
  it("Rust와 같은 규칙으로 위반을 가려낸다", () => {
    expect(checkEntryName("회의", [], "file")).toBeNull();
    expect(checkEntryName("  회의  ", [], "file")).toBeNull();
    expect(checkEntryName("", [], "file")).toBe("empty");
    expect(checkEntryName("   ", [], "file")).toBe("empty");
    expect(checkEntryName(".숨김", [], "file")).toBe("hidden");
    expect(checkEntryName("하위/회의", [], "file")).toBe("invalid");
    expect(checkEntryName("제어\u0000문자", [], "file")).toBe("invalid");
  });

  // 왜: 중복은 Rust가 AlreadyExists로 막지만, 확정을 누른 뒤에 알면 사용자는 이미 이름을
  //     다 쳤다 — 치는 동안 알려야 고쳐 쓸 수 있다.
  // 보장: 확장자 수렴 뒤에 같아지는 이름도 중복으로 잡힌다(회의 → 회의.md).
  // 경계: 폴더는 확장자를 붙이지 않으므로 이름 그대로 비교한다.
  it("확장자를 수렴한 뒤의 이름으로 중복을 본다", () => {
    expect(checkEntryName("회의", ["회의.md"], "file")).toBe("duplicate");
    expect(checkEntryName("회의.md", ["회의.md"], "file")).toBe("duplicate");
    expect(checkEntryName("결산", ["회의.md"], "file")).toBeNull();
    expect(checkEntryName("묶음", ["묶음"], "dir")).toBe("duplicate");
    expect(checkEntryName("묶음", ["묶음.md"], "dir")).toBeNull();
  });

  // 왜: 이 맥에서 a.md를 만든 뒤 A.md의 존재를 물으면 참이 나온다 — 대소문자만 다른 이름을
  //     통과시키면 Rust가 거부할 이름을 프론트가 허락하게 된다.
  // 보장: 대소문자만 다른 이름도 중복으로 잡힌다.
  // 경계: 대소문자 교정(자기 자신으로 바꾸기)은 이름 변경의 예외라 Rust가 판정한다 —
  //       그 흐름은 형제 목록에서 자기를 빼고 부르는 호출 측 책임이다.
  it("대소문자만 다른 이름도 중복으로 본다", () => {
    expect(checkEntryName("Notes", ["notes.md"], "file")).toBe("duplicate");
  });
});

describe("withMarkdownExtension", () => {
  // 집행: rust-commands.md#항목-이름-규칙 — ".md/.markdown으로 끝나지 않으면 .md를 덧붙인다".
  // 왜: 입력칸에 보이는 이름과 실제로 만들어지는 이름이 달라지면 사용자가 예측할 수 없다 —
  //     프론트가 Rust와 같은 규칙으로 미리 보여 준다.
  // 보장: 마크다운 확장자가 아닌 꼬리에는 .md가 붙고, 맞으면 그대로 둔다(대소문자 무관).
  // 경계: 이름 규칙 위반은 여기서 걸러내지 않는다 — checkEntryName의 몫이다.
  it("마크다운 확장자로 수렴한다", () => {
    expect(withMarkdownExtension("회의")).toBe("회의.md");
    expect(withMarkdownExtension("회의.md")).toBe("회의.md");
    expect(withMarkdownExtension("회의.MD")).toBe("회의.MD");
    expect(withMarkdownExtension("긴글.markdown")).toBe("긴글.markdown");
    expect(withMarkdownExtension("v1.2")).toBe("v1.2.md");
  });
});

describe("defaultEntryName", () => {
  // 왜: 입력칸을 기본 이름으로 채우면 Enter만으로 만들 수 있는데, 두 번째부터는 같은 이름이
  //     돼 매번 거부당한다 — 번호를 미리 붙여 채운다.
  // 보장: 비어 있으면 기본 이름 그대로, 겹치면 2부터 빈 번호를 찾는다.
  // 경계: 사용자가 고쳐 친 이름에는 번호를 붙이지 않는다 — 중복이면 거부다(checkEntryName).
  it("겹치지 않는 기본 이름을 만든다", () => {
    expect(defaultEntryName("file", [])).toBe("새 파일.md");
    expect(defaultEntryName("file", ["새 파일.md"])).toBe("새 파일 2.md");
    expect(defaultEntryName("file", ["새 파일.md", "새 파일 2.md"])).toBe("새 파일 3.md");
    expect(defaultEntryName("dir", [])).toBe("새 폴더");
    expect(defaultEntryName("dir", ["새 폴더"])).toBe("새 폴더 2");
  });

  // 왜: 번호를 건너뛰면 새 파일 2가 있는데 새 파일 3이 생겨 목록이 어수선해진다.
  // 보장: 중간이 비어 있으면 그 번호를 먼저 쓴다.
  it("빈 번호를 앞에서부터 채운다", () => {
    expect(defaultEntryName("file", ["새 파일.md", "새 파일 3.md"])).toBe("새 파일 2.md");
  });
});
