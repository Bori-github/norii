# 프리뷰 전략 (markdown-it · sanitize · 스크롤 동기화)

norii는 소스 옆에 렌더된 프리뷰를 분할로 보여준다. 이 문서는 프리뷰 파이프라인의 단일 출처다.

핵심 결정은 **파싱/렌더를 웹뷰(JS)에서 한다**는 것이다. Rust로 내리면 라이브 프리뷰가 키 입력마다 IPC 왕복이 되어 반응성이 나빠진다(→ [아키텍처](architecture.md#프리뷰-파서를-웹뷰에-두는-이유)).

## 파이프라인 (웹뷰 내)

```text
소스 텍스트
  → markdown-it   파싱 + HTML 생성 (GFM 옵션: 테이블·체크박스·취소선)
  → DOMPurify     sanitize (필수)
  → 프리뷰 DOM 삽입
```

파이프라인 로직은 `packages/markdown`에 둔다. DOM 삽입은 소비 측(`apps/desktop`)이 담당한다(→ [파일/폴더 구조](project-structure.md)).

## 디바운스

매 키 입력마다 전체 재파싱하지 않는다. 변경을 디바운스하고, 여력이 되면 증분 렌더로 발전시킨다. 이는 [작업 규칙](../rules/project-rules.md)의 성능 규칙이다.

**값(M3 실측으로 확정) — 적응형**: 기본 **150ms**에서 시작하고, 직전 렌더 소요에 따라 `clamp(직전 렌더 ms × 3, 150ms, 1000ms)`로 조정한다. 구현 상수·계산은 `apps/desktop/src/widgets/preview-pane/config.ts`가 단일 코드 지점이다.

근거(실측 2026-07-12, Vitest Browser Mode WebKit·macOS 13): 렌더 1회 비용이 2KB 문서 3ms · 61KB 50ms · 246KB 202ms · 620KB 472ms(중앙값). 작은 문서는 150ms면 즉각 반응하고, 렌더가 디바운스보다 오래 걸리는 큰 문서는 타이핑의 짧은 멈춤마다 렌더가 끼어들어 입력이 버벅이므로 렌더 비용에 비례해 간격을 자동으로 벌린다.

## Sanitize는 필수다

DOMPurify는 옵션이 아니라 **필수**다. 마크다운은 원시 HTML을 허용하고, norii는 `<details>` 같은 태그를 의도적으로 통과시킨다(→ [에디터 전략](editor-strategy.md)). 사용자 문서에 스크립트가 섞일 수 있으므로 Tauri 웹뷰라도 sanitize 없이 삽입하지 않는다.

수식(KaTeX)·다이어그램(Mermaid)은 sanitize와 상호작용한다 — KaTeX는 MathML 마크업을 허용해야 하고, Mermaid SVG는 정화 뒤에 렌더한다. 별도 정책은 아래 [수식·다이어그램 지원](#수식다이어그램-지원-채택)에 둔다.

## 스크롤 동기화

소스↔프리뷰 스크롤을 연동한다. 소스 라인 ↔ 렌더 블록 매핑 테이블을 유지한다(`packages/markdown`). 매핑·연동 로직은 norii가 직접 구현한다.

## 두 파서 원칙

에디터(CM6 내장 Lezer)와 프리뷰(markdown-it)는 별개 파서다. **완벽 일치를 추구하지 않는다.** 하이라이팅은 근사치여도 되고, 아주 드문 중첩 문법에서 둘의 해석이 미묘하게 갈릴 수 있다. **최종 결과물의 진실은 프리뷰(markdown-it)** 다. 이 원칙을 잡으면 두 파서를 억지로 맞추느라 복잡해지는 것을 피한다.

## 수식·다이어그램 지원 (채택)

각주·수식(KaTeX)·다이어그램(Mermaid)을 **지원한다.** 도입은 이후 마일스톤이다(→ [실제 구현 계획](implementation-plan.md)). 셋은 구현 방식·번들·sanitize 경계가 서로 달라 아래에 못박는다.

```text
markdown-it-footnote        각주        markdown-it 플러그인
@vscode/markdown-it-katex   수식(KaTeX) markdown-it 플러그인 (Microsoft 포크)
mermaid                     다이어그램  플러그인 아님 — fence 렌더 + 클라이언트 렌더
```

### 수식 (KaTeX)

- **`@vscode/markdown-it-katex`**(Microsoft 유지보수 포크)를 쓴다. 원본 `markdown-it-katex`는 사실상 대체됐고 `markdown-it-texmath`도 저활동이라 낮은 bus-factor다. VS Code가 실사용하는 1st-party 포크가 안전하다.
- 인라인 `$…$`·블록 `$$…$$`. KaTeX는 HTML/MathML을 출력하므로 **sanitize가 그 마크업을 깎지 않도록** DOMPurify 정책에 MathML·KaTeX 마크업을 허용한다(→ [Sanitize는 필수다](#sanitize는-필수다)).
- KaTeX CSS·폰트는 **로컬 번들**(외부 CDN 금지 — CSP `style-src`·`font-src 'self'`, → [보안](security.md)).

### 다이어그램 (Mermaid)

- Mermaid는 **markdown-it 플러그인이 아니다.** ` ```mermaid ` 펜스를 커스텀 fence 규칙으로 플레이스홀더(`<div class="mermaid">…`)로 내보내고, DOM 삽입 후 클라이언트에서 `mermaid`가 SVG로 렌더한다.
- **sanitize 순서**: mermaid SVG는 신뢰된 엔진 출력이므로 원문을 **DOMPurify로 정화한 뒤** 그 자리에 렌더하고, mermaid `securityLevel: 'strict'`로 스크립트를 봉쇄한다. (사용자 원문은 sanitize를 거치고, SVG는 엔진이 안전한 자리에만 그린다.)
- **번들 방어**: mermaid는 무겁다(d3 등 동반). 초기 번들 목표(<15MB, → [작업 규칙](../rules/project-rules.md))를 지키기 위해 **문서에 다이어그램이 있을 때만 동적 import(lazy-load)** 한다.
- **라이브 프리뷰 비용**: 디바운스 갱신마다 전체 다이어그램을 다시 그리지 않는다. 바뀐 펜스만 재렌더한다.
