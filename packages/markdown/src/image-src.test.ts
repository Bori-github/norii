import { describe, expect, it } from "vitest";

import { resolveImagePath } from "./image-src";

// 집행: preview-strategy.md#경로-해석 — 상대 경로는 문서 폴더, `/`는 연 폴더 기준이다.
//
// 왜: 마크다운의 이미지 경로는 문서가 있는 폴더 기준이고, 웹뷰는 그 기준을 모른다.
//     여기서 절대 경로로 바꾸지 않으면 웹뷰가 자기 origin 기준으로 엉뚱한 곳을 찾는다.
// 보장: 기준 폴더가 있는 경우 정규화된 절대 경로를 만들고, 없는 경우 해석하지 않는다.
// 경계: 파일이 실제로 있는지는 보지 않는다(없으면 프리뷰가 못 찾은 이미지로 다룬다).
//       경로 → URL 변환은 소비 측이 넘긴다 — 이 함수는 경로까지만 만든다.
describe("resolveImagePath — 이미지 경로 해석", () => {
  const base = { docDir: "/vault/노트", rootDir: "/vault" };

  describe("그대로 두는 것", () => {
    // 왜: 스킴이 있으면 이미 완결된 주소다. 문서 폴더를 앞에 붙이면 주소가 망가진다.
    it.each([
      "https://example.com/사진.png",
      "http://example.com/사진.png",
      "data:image/png;base64,iVBORw0KGgo=",
      "asset://localhost/etc/passwd",
      "file:///etc/passwd",
    ])("스킴이 있는 경우 그대로 둔다: %s", (src) => {
      expect(resolveImagePath(base, src)).toBeNull();
    });

    // 왜: `//호스트/경로`는 프로토콜만 생략한 원격 주소다. 경로로 착각해 이어 붙이면
    //     엉뚱한 로컬 경로가 된다.
    it("프로토콜을 생략한 경우 그대로 둔다", () => {
      expect(resolveImagePath(base, "//example.com/사진.png")).toBeNull();
    });

    // 왜: Untitled 문서는 기준 폴더가 없다 — 상대 경로를 풀 방법이 없다.
    it("문서 경로가 없는 경우 상대 경로를 그대로 둔다", () => {
      expect(resolveImagePath({ docDir: null, rootDir: "/vault" }, "./사진.png")).toBeNull();
    });

    it("폴더를 열지 않은 경우 `/`로 시작하는 경로를 그대로 둔다", () => {
      expect(resolveImagePath({ docDir: "/vault/노트", rootDir: null }, "/사진.png")).toBeNull();
    });

    it("빈 src인 경우 그대로 둔다", () => {
      expect(resolveImagePath(base, "")).toBeNull();
    });
  });

  describe("문서 폴더 기준으로 푸는 것", () => {
    it("같은 폴더의 파일을 해석한다", () => {
      expect(resolveImagePath(base, "사진.png")).toBe("/vault/노트/사진.png");
      expect(resolveImagePath(base, "./사진.png")).toBe("/vault/노트/사진.png");
    });

    it("하위 폴더의 경로를 해석한다", () => {
      expect(resolveImagePath(base, "이미지/사진.png")).toBe("/vault/노트/이미지/사진.png");
    });

    // 왜: asset 프로토콜이 `..`이 든 경로를 거부한다 — 넘기기 전에 없애야 한다.
    it("상위로 올라가는 경로를 정규화한다", () => {
      expect(resolveImagePath(base, "../사진.png")).toBe("/vault/사진.png");
      expect(resolveImagePath(base, "../자료/../사진.png")).toBe("/vault/사진.png");
    });

    // 경계: 루트 위로는 올라가지 않는다 — 올라가려는 만큼 무시한다.
    it("루트 위로는 올라가지 않는다", () => {
      expect(resolveImagePath({ docDir: "/vault", rootDir: null }, "../../../사진.png")).toBe(
        "/사진.png",
      );
    });

    // 왜: markdown-it이 `![](내 사진.png)`을 `%EB%82%B4%20%EC%82%AC%EC%A7%84.png`로
    //     정규화해 넘긴다. 풀지 않으면 그 이름의 파일을 찾지 못한다.
    it("퍼센트 인코딩을 푼 뒤 해석한다", () => {
      expect(resolveImagePath(base, "%EB%82%B4%20%EC%82%AC%EC%A7%84.png")).toBe(
        "/vault/노트/내 사진.png",
      );
    });

    // 경계: 깨진 인코딩(`%`)은 decodeURIComponent가 던진다 — 원문 그대로 쓴다.
    it("깨진 퍼센트 인코딩은 원문 그대로 쓴다", () => {
      expect(resolveImagePath(base, "100%.png")).toBe("/vault/노트/100%.png");
    });

    it("문서 폴더 끝의 슬래시는 겹치지 않는다", () => {
      expect(resolveImagePath({ docDir: "/vault/", rootDir: null }, "사진.png")).toBe(
        "/vault/사진.png",
      );
    });
  });

  describe("연 폴더 기준으로 푸는 것", () => {
    it("`/`로 시작하는 경우 연 폴더 기준으로 해석한다", () => {
      expect(resolveImagePath(base, "/이미지/사진.png")).toBe("/vault/이미지/사진.png");
    });

    it("연 폴더 끝의 슬래시는 겹치지 않는다", () => {
      expect(resolveImagePath({ docDir: "/vault/노트", rootDir: "/vault/" }, "/사진.png")).toBe(
        "/vault/사진.png",
      );
    });

    // 경계: 두 기준은 별개다 — 한쪽이 없어도 나머지 한쪽은 푼다.
    it("문서 경로가 없어도 연 폴더가 있는 경우 해석한다", () => {
      expect(resolveImagePath({ docDir: null, rootDir: "/vault" }, "/사진.png")).toBe(
        "/vault/사진.png",
      );
    });
  });
});
