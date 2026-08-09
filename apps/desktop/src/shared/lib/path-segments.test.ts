import { describe, expect, it } from "vitest";

import { entryNameOf, pathSegmentsWithinRoot } from "./path-segments";

// 왜: 탭 제목·사이드바 헤더·최근 파일 목록이 같은 규칙으로 이름을 만들어야 한다 —
//     따로 구현하면 같은 파일이 자리마다 다른 이름으로 보일 수 있다.
// 보장: 마지막 구분자 뒤가 이름이고, 양쪽 구분자(/·\)를 다루며, 이름이 비면 경로 그대로다.
// 경계: 확장자 표시 여부는 사용처가 정한다 — 이 함수는 항목 이름만 만든다.
describe("경로의 마지막 항목 이름", () => {
  it("파일명과 폴더명을 돌려준다", () => {
    expect(entryNameOf("/글/회고/회고.md")).toBe("회고.md");
    expect(entryNameOf("/글/회고")).toBe("회고");
    expect(entryNameOf("\\\\?\\C:\\글\\회고.md")).toBe("회고.md");
  });

  it("이름이 비면 경로 그대로 돌려준다", () => {
    expect(entryNameOf("/")).toBe("/");
  });
});

// 왜: 상태 바의 경로는 "연 폴더 안 어디"만 답한다. 기준이 없거나 맞지 않을 때 다른 규칙으로
//     답하면 같은 표기가 상황마다 다른 뜻이 된다.
// 보장: 연 폴더와 파일 사이의 폴더만 돌려주고, 그 밖의 경우는 빈 목록이다.
// 경계: 어떻게 줄여 보여줄지는 상태 바가 정한다 — 이 함수는 조각만 만든다.

describe("연 폴더 기준 폴더 조각", () => {
  it("연 폴더와 파일 사이의 폴더를 순서대로 돌려준다", () => {
    expect(pathSegmentsWithinRoot("/글/회고/2026/회고.md", "/글")).toEqual(["회고", "2026"]);
  });

  it("연 폴더 바로 아래 파일은 조각이 없다", () => {
    expect(pathSegmentsWithinRoot("/글/할일.md", "/글")).toEqual([]);
  });

  it("저장하지 않은 문서는 경로가 없다", () => {
    expect(pathSegmentsWithinRoot(null, "/글")).toEqual([]);
  });

  it("연 폴더가 없으면 비운다", () => {
    expect(pathSegmentsWithinRoot("/글/회고/회고.md", null)).toEqual([]);
  });

  it("연 폴더 밖 파일은 비운다", () => {
    expect(pathSegmentsWithinRoot("/내려받기/받은글.md", "/글")).toEqual([]);
  });

  it("이름이 겹쳐 시작하는 다른 폴더는 안쪽이 아니다", () => {
    expect(pathSegmentsWithinRoot("/글쓰기/회고/회고.md", "/글")).toEqual([]);
  });

  it("연 폴더 경로 끝의 슬래시는 있으나 없으나 같다", () => {
    expect(pathSegmentsWithinRoot("/글/회고/회고.md", "/글/")).toEqual(["회고"]);
  });

  it("파일 자신이 연 폴더면 비운다", () => {
    expect(pathSegmentsWithinRoot("/글", "/글")).toEqual([]);
  });
});
