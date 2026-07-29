import { describe, expect, it } from "vitest";

import { pathSegmentsWithinRoot } from "./path-segments";

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
