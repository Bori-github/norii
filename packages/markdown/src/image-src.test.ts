import { describe, expect, it } from "vitest";

import { resolveImagePath } from "./image-src";

// 집행: preview-strategy.md#경로-해석 — 문서 폴더 기준으로 이미지 경로를 찾는다.
//
// 왜: 마크다운의 이미지 경로는 문서가 있는 폴더 기준이고, 웹뷰는 그 기준을 모른다.
//     여기서 절대 경로로 바꾸지 않으면 웹뷰가 자기 origin 기준으로 엉뚱한 곳을 찾는다.
// 보장: 스킴이 있는 src는 그대로 두고, 상대·절대 경로만 문서 폴더 기준 절대 경로로 만든다.
//       퍼센트 인코딩을 풀고 `.`·`..`를 정규화한다.
// 경계: 파일이 실제로 있는지는 보지 않는다(없으면 프리뷰가 못 찾은 이미지로 다룬다).
//       경로 → URL 변환은 소비 측이 넘긴다 — 이 함수는 경로까지만 만든다.
describe("resolveImagePath — 이미지 경로 해석", () => {
  const docDir = "/vault/노트";

  describe("그대로 두는 것", () => {
    // 왜: 스킴이 있으면 이미 완결된 주소다. 문서 폴더를 앞에 붙이면 주소가 망가진다.
    it.each([
      "https://example.com/사진.png",
      "http://example.com/사진.png",
      "data:image/png;base64,iVBORw0KGgo=",
      "asset://localhost/etc/passwd",
      "file:///etc/passwd",
    ])("스킴이 있는 src는 건드리지 않는다: %s", (src) => {
      expect(resolveImagePath(docDir, src)).toBeNull();
    });

    // 왜: `//호스트/경로`는 프로토콜만 생략한 원격 주소다. 경로로 착각해 이어 붙이면
    //     엉뚱한 로컬 경로가 된다.
    it("프로토콜 생략 주소(//)는 건드리지 않는다", () => {
      expect(resolveImagePath(docDir, "//example.com/사진.png")).toBeNull();
    });

    // 왜: Untitled 문서는 기준 폴더가 없다 — 상대 경로를 풀 방법이 없다.
    it("문서 경로를 모르면 해석하지 않는다", () => {
      expect(resolveImagePath(null, "./사진.png")).toBeNull();
    });

    it("빈 src는 해석하지 않는다", () => {
      expect(resolveImagePath(docDir, "")).toBeNull();
    });
  });

  describe("문서 폴더 기준으로 푸는 것", () => {
    it("같은 폴더의 파일을 찾는다", () => {
      expect(resolveImagePath(docDir, "사진.png")).toBe("/vault/노트/사진.png");
      expect(resolveImagePath(docDir, "./사진.png")).toBe("/vault/노트/사진.png");
    });

    it("하위 폴더를 따라간다", () => {
      expect(resolveImagePath(docDir, "이미지/사진.png")).toBe("/vault/노트/이미지/사진.png");
    });

    // 왜: asset 프로토콜이 `..`이 든 경로를 거부한다 — 넘기기 전에 없애야 한다.
    it("상위로 올라가는 경로를 정규화한다", () => {
      expect(resolveImagePath(docDir, "../사진.png")).toBe("/vault/사진.png");
      expect(resolveImagePath(docDir, "../자료/../사진.png")).toBe("/vault/사진.png");
    });

    // 경계: 루트 위로는 올라가지 않는다 — 올라가려는 만큼 무시한다.
    it("루트 위로는 올라가지 않는다", () => {
      expect(resolveImagePath("/vault", "../../../사진.png")).toBe("/사진.png");
    });

    it("절대 경로는 문서 폴더를 붙이지 않는다", () => {
      expect(resolveImagePath(docDir, "/그림/사진.png")).toBe("/그림/사진.png");
    });

    // 왜: markdown-it이 `![](내 사진.png)`을 `%EB%82%B4%20%EC%82%AC%EC%A7%84.png`로
    //     정규화해 넘긴다. 풀지 않으면 그 이름의 파일을 찾지 못한다.
    it("퍼센트 인코딩을 푼다", () => {
      expect(resolveImagePath(docDir, "%EB%82%B4%20%EC%82%AC%EC%A7%84.png")).toBe(
        "/vault/노트/내 사진.png",
      );
    });

    // 경계: 깨진 인코딩(`%`)은 decodeURIComponent가 던진다 — 원문 그대로 쓴다.
    it("깨진 퍼센트 인코딩은 원문 그대로 쓴다", () => {
      expect(resolveImagePath(docDir, "100%.png")).toBe("/vault/노트/100%.png");
    });

    it("문서 폴더 끝의 슬래시는 겹치지 않는다", () => {
      expect(resolveImagePath("/vault/", "사진.png")).toBe("/vault/사진.png");
    });
  });
});
