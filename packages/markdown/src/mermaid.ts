import type MarkdownIt from "markdown-it";

// mermaid 펜스 → 플레이스홀더(→ preview-strategy.md#다이어그램-mermaid).
//
// mermaid는 markdown-it 플러그인이 아니다. 파서는 ```mermaid 펜스를 **빈 div**로 바꾸고
// 원문만 data 속성에 실어 보낸다. SVG는 소비 측이 DOM 삽입 후 클라이언트에서 그린다:
//   - 무거운 mermaid(d3 동반)가 파서 패키지에 상시 묶이지 않는다 — lazy-load의 전제다.
//   - sanitize 순서가 지켜진다 — 사용자 원문은 DOMPurify를 거치고, 엔진이 만든 SVG는
//     정화된 자리에만 들어간다(SVG를 sanitize에 태우면 렌더가 깎인다).
//
// 두 이름은 소비 측과의 계약이다 — 클라이언트가 이 클래스로 찾고 이 속성으로 원문을 읽는다.
// data-* 이름인 것이 sanitize를 통과하는 근거다(DOMPurify 기본 허용, → preview-strategy.md).

/** 플레이스홀더 div의 클래스 — 소비 측이 렌더 대상을 찾는 선택자다. */
export const MERMAID_PLACEHOLDER_CLASS = "norii-mermaid";

/** 펜스 원문을 담는 속성 — 값은 퍼센트 인코딩이다(아래 이유). 읽을 때 decodeMermaidSource. */
export const MERMAID_CODE_ATTR = "data-mermaid-source";

// 원문을 **퍼센트 인코딩**해 싣는 이유: DOMPurify는 값에 `-->`(XML 주석 닫기 시퀀스)가
// 들어 있으면 그 속성을 통째로 버린다(SAFE_FOR_XML 방어). 그런데 `-->`는 mermaid
// 플로차트의 화살표라 거의 모든 다이어그램에 나온다 — 날것으로 실으면 다이어그램이 조용히
// 사라진다(M4 실측으로 발견). 인코딩하면 값에 `>`·`<`가 아예 없어 방어에 걸리지 않는다.
// 인코딩과 디코딩을 한 파일에 두어 소비 측이 규칙을 다시 알 필요가 없게 한다.

/** 플레이스홀더의 속성값을 원래 mermaid 원문으로 되돌린다. */
export function decodeMermaidSource(value: string): string {
  return decodeURIComponent(value);
}

/** 정보 문자열의 첫 낱말이 mermaid인가 — ```mermaid, ```Mermaid, ```mermaid v2 를 받는다. */
function isMermaidFence(info: string): boolean {
  return info.trim().split(/\s+/)[0]?.toLowerCase() === "mermaid";
}

export function mermaidFencePlugin(md: MarkdownIt): void {
  const renderFence = md.renderer.rules.fence;

  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    if (!token || !isMermaidFence(token.info)) {
      return renderFence
        ? renderFence(tokens, idx, options, env, self)
        : self.renderToken(tokens, idx, options);
    }
    // 라인 꼬리표(data-source-line)는 이미 코어 룰이 이 토큰에 달아 뒀다 — renderAttrs로
    // 함께 내보내야 다이어그램도 스크롤 동기화에 참여한다(→ line-map.ts).
    token.attrJoin("class", MERMAID_PLACEHOLDER_CLASS);
    token.attrSet(MERMAID_CODE_ATTR, encodeURIComponent(token.content));
    return `<div${self.renderAttrs(token)}></div>\n`;
  };
}
