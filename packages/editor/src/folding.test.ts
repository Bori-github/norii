import { markdown } from "@codemirror/lang-markdown";
import { foldable, foldEffect, foldedRanges } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";

import { noriiEditorExtensions } from "./extensions";
import { markdownFolding } from "./folding";
import type { EditorColors } from "./theme";

// 집행: editor-strategy.md#하이브리드-접기-아웃라이너-대체 — 접기 규칙(헤딩 섹션·리스트
//       항목·블록)은 lang-markdown 내장을 채택하고, norii는 켜기만 한다.
//       접기는 순전히 에디터 표현이다 — .md 내용은 바뀌지 않는다(경계 규칙).
// 왜: 규칙을 우리가 소유하지 않으므로, 의존하는 내장 동작을 테스트로 고정해야
//     lang-markdown 업그레이드가 접기 범위를 바꾸는 것을 게이트가 감지한다.
//     범위가 틀리면 접는 순간 문서 일부가 "사라진 것처럼" 보인다 — 섹션·계층 경계가
//     정확해야 아웃라이너 대체라는 목적이 선다.
// 보장: 헤딩은 다음 같은/상위 레벨 직전까지(하위 헤딩 포함, 마지막 섹션은 문서 끝,
//       코드 펜스·인용문이 경계를 끊지 않음), 리스트 항목은 자기 들여쓰기 계층만,
//       여러 줄 블록(문단)도 접힌다. 빈 섹션·한 줄 항목·한 줄 문단은 접지 않는다.
// 경계: 접힘 UI(거터·placeholder)·키맵 실동작은 CM6 기본을 신뢰한다(단축키 계약 표).
//       접힘 상태 영속화는 하지 않는다(→ editor-strategy.md#접힘-상태-영속화).

function stateOf(doc: string): EditorState {
  return EditorState.create({ doc, extensions: [markdown(), markdownFolding()] });
}

/** 줄 번호(1부터)의 접기 범위를 "줄 번호 구간"으로 요약한다 — 오프셋보다 의도가 읽히게. */
function foldedLines(state: EditorState, lineNumber: number): [number, number] | null {
  const line = state.doc.line(lineNumber);
  const range = foldable(state, line.from, line.to);
  if (range === null) {
    return null;
  }
  return [state.doc.lineAt(range.from).number, state.doc.lineAt(range.to).number];
}

describe("헤딩 접기 (내장 규칙 고정)", () => {
  it("같은 레벨의 다음 헤딩 직전까지 접는다", () => {
    const state = stateOf(["## 첫 절", "본문 1", "본문 2", "## 둘째 절", "본문 3"].join("\n"));
    expect(foldedLines(state, 1)).toEqual([1, 3]);
  });

  it("하위 레벨 헤딩은 상위 섹션 안에 포함된다", () => {
    const state = stateOf(["# 장", "본문", "## 절", "절 본문", "# 다음 장"].join("\n"));
    expect(foldedLines(state, 1)).toEqual([1, 4]);
    expect(foldedLines(state, 3)).toEqual([3, 4]);
  });

  it("마지막 섹션은 문서 끝까지 접는다", () => {
    const state = stateOf(["# 제목", "본문 1", "본문 2"].join("\n"));
    expect(foldedLines(state, 1)).toEqual([1, 3]);
  });

  it("본문 없는 헤딩(바로 다음이 같은 레벨)은 접을 것이 없다", () => {
    const state = stateOf(["## 빈 절", "## 다음 절", "본문"].join("\n"));
    expect(foldedLines(state, 1)).toBeNull();
  });

  it("코드 펜스 안의 #은 헤딩이 아니다 — 접지도, 섹션을 끊지도 않는다", () => {
    const state = stateOf(["# 제목", "```", "# 코드 주석", "```", "본문"].join("\n"));
    expect(foldedLines(state, 3)).toBeNull();
    expect(foldedLines(state, 1)).toEqual([1, 5]);
  });

  it("인용문 안의 헤딩은 섹션 경계가 아니다", () => {
    const state = stateOf(["## 절", "본문", "> # 인용 속 제목", "이어지는 본문"].join("\n"));
    expect(foldedLines(state, 1)).toEqual([1, 4]);
  });
});

describe("리스트 접기 (내장 규칙 고정)", () => {
  it("하위 불릿을 가진 항목은 첫 줄만 남기고 접힌다", () => {
    const state = stateOf(["- 부모", "  - 자식 1", "  - 자식 2", "- 다음 부모"].join("\n"));
    expect(foldedLines(state, 1)).toEqual([1, 3]);
  });

  it("한 줄 항목은 접지 않는다", () => {
    const state = stateOf(["- 하나", "- 둘"].join("\n"));
    expect(foldedLines(state, 1)).toBeNull();
  });

  it("중첩 항목 자체도 자기 계층을 접는다", () => {
    const state = stateOf(
      ["- 부모", "  - 자식", "    - 손자 1", "    - 손자 2", "  - 다음 자식"].join("\n"),
    );
    expect(foldedLines(state, 2)).toEqual([2, 4]);
  });

  it("순서 목록도 같은 규칙으로 접힌다", () => {
    const state = stateOf(["1. 첫째", "   이어지는 문단", "2. 둘째"].join("\n"));
    expect(foldedLines(state, 1)).toEqual([1, 2]);
  });

  it("항목의 이어지는 들여쓴 문단도 접힘 범위에 든다", () => {
    const state = stateOf(
      ["- 항목", "  이어지는 설명 줄", "", "  더 깊은 설명", "- 다음"].join("\n"),
    );
    expect(foldedLines(state, 1)).toEqual([1, 4]);
  });
});

// 왜: 접기 범위 테스트는 markdownFolding()을 직접 켜므로, 에디터 확장 묶음에서 접기가
//     빠져도(배선 절단) 통과한다 — 배선이 어디에도 고정되지 않으면 기능이 조용히 사라진다.
// 보장: 앱이 실제로 쓰는 noriiEditorExtensions 상태에서 접기 상태(codeFolding)가 살아
//       있다 — fold 이펙트를 적용하면 접힌 범위가 기록된다. extensions.ts에서
//       markdownFolding()을 제거하면 이 테스트가 실패한다(변이 검증).
// 경계: 거터 표시·키맵 실동작(view 계층)은 CM6 기본을 신뢰한다(단축키 계약 표).
describe("에디터 확장 배선 (변이 검증)", () => {
  const COLORS: EditorColors = {
    paper: "var(--paper)",
    text: "var(--text)",
    muted: "var(--muted)",
    mark: "var(--mark)",
    accent: "var(--accent)",
    hover: "var(--hover)",
    selection: "var(--selection)",
    match: "var(--match)",
    border: "var(--border)",
  };

  it("noriiEditorExtensions에 접기가 배선되어 있다 — fold 이펙트가 기록된다", () => {
    const state = EditorState.create({
      doc: ["# 제목", "본문 1", "본문 2"].join("\n"),
      extensions: noriiEditorExtensions(COLORS),
    });
    const line = state.doc.line(1);
    const range = foldable(state, line.from, line.to);
    expect(range).not.toBeNull();

    const folded = state.update({ effects: foldEffect.of(range!) }).state;
    let count = 0;
    foldedRanges(folded).between(0, folded.doc.length, () => {
      count += 1;
    });
    expect(count).toBe(1);
  });
});

describe("블록 접기 (내장 잉여분 — 함께 켜짐을 고정)", () => {
  it("여러 줄 문단은 블록으로 접힌다 (VS Code 관례)", () => {
    const state = stateOf(["문단 첫 줄", "문단 둘째 줄", "", "다음 문단"].join("\n"));
    expect(foldedLines(state, 1)).toEqual([1, 2]);
  });

  it("한 줄 문단은 접지 않는다", () => {
    const state = stateOf(["한 줄 문단", "", "다음"].join("\n"));
    expect(foldedLines(state, 1)).toBeNull();
  });

  it("코드 펜스는 여는 줄만 남기고 접힌다", () => {
    const state = stateOf(["```", "코드 1", "코드 2", "```"].join("\n"));
    expect(foldedLines(state, 1)).toEqual([1, 4]);
  });
});
