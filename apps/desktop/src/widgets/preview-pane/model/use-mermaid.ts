import { type RefObject, useEffect, useState } from "react";

import { decodeMermaidSource, MERMAID_CODE_ATTR, MERMAID_PLACEHOLDER_CLASS } from "@norii/markdown";

import { useResolvedTheme } from "@entities/theme";
import { STRINGS } from "@shared/config";

// 다이어그램 렌더 — 파서가 낸 빈 플레이스홀더를 SVG로 채운다(→ preview-strategy.md#다이어그램-mermaid).
//
// 이 훅이 지는 세 가지 부담:
//   1) lazy-load — mermaid는 무겁다(d3 동반). 문서에 다이어그램이 **있을 때만** import한다.
//      번들 크기가 아니라 기동 비용을 지키는 장치다(청크는 어차피 앱에 들어간다).
//   2) 캐시 — 디바운스 갱신마다 전부 다시 그리지 않는다. (테마, 원문)이 같으면 이전 SVG를
//      그대로 다시 꽂는다. 타이핑 중 다이어그램이 매번 깜빡이지 않게 하는 것이 목적이다.
//   3) sanitize 경계의 뒤집힘 — 원문은 이미 DOMPurify를 통과했고, 여기서 넣는 SVG는 신뢰된
//      엔진 출력이다. securityLevel 'strict'가 라벨 속 스크립트·HTML을 봉쇄한다.

type MermaidApi = typeof import("mermaid").default;
type MermaidImporter = () => Promise<{ default: MermaidApi }>;

const realImporter: MermaidImporter = () => import("mermaid");
let importMermaid: MermaidImporter = realImporter;

/** 테스트 전용 — 로드 실패(간헐 네트워크)를 주입한다. null이면 실제 import로 되돌린다. */
export function setMermaidImporterForTest(importer: MermaidImporter | null): void {
  importMermaid = importer ?? realImporter;
}

let mermaidPromise: Promise<MermaidApi> | null = null;

function loadMermaid(): Promise<MermaidApi> {
  if (mermaidPromise === null) {
    const loading = importMermaid().then((module) => module.default);
    // **실패한 로드는 캐시하지 않는다.** mermaid는 동적 청크가 많아 로드가 간헐적으로
    // 실패한다(실측 — 브라우저 테스트를 직렬화한 사유). 거부된 프로미스를 캐시하면
    // 그 순간부터 앱을 재시작할 때까지 모든 다이어그램이 죽는다. 지워 두면 다음
    // 갱신이 처음부터 다시 시도한다.
    loading.catch(() => {
      mermaidPromise = null;
    });
    mermaidPromise = loading;
  }
  return mermaidPromise;
}

// 렌더 결과 캐시 — 키는 (테마, 원문). 프리뷰가 스왑돼도 살아남아야 하므로 모듈 수준이다.
//
// **상한이 필요하다.** 다이어그램을 타이핑하는 동안 디바운스 갱신마다 "그때까지 쓴 원문"이
// 새 키가 되므로, 상한이 없으면 편집 중간 상태의 SVG가 무한히 쌓인다(SVG 하나가 수십 KB다).
// 삽입 순서가 곧 나이인 Map의 성질을 이용해 가장 오래된 것부터 버린다.
const SVG_CACHE_LIMIT = 32;
const svgCache = new Map<string, string>();

function cacheSvg(key: string, svg: string): void {
  svgCache.set(key, svg);
  for (const oldest of svgCache.keys()) {
    if (svgCache.size <= SVG_CACHE_LIMIT) {
      break;
    }
    svgCache.delete(oldest);
  }
}

// mermaid는 렌더마다 고유 id를 요구한다(같은 id를 재사용하면 임시 노드가 충돌한다).
let renderSeq = 0;

// id에는 난수 꼬리를 붙인다 — 순번만 쓰면 예측 가능해서, 문서가 원시 HTML로 같은 id를
// 선점해 mermaid의 임시 노드 처리와 충돌시킬 수 있다(문서 내용은 우리가 못 믿는 입력이다).
function nextRenderId(): string {
  renderSeq += 1;
  return `norii-mermaid-${renderSeq}-${Math.random().toString(36).slice(2, 8)}`;
}

// 에러 임시 노드 제거는 **프리뷰 밖**만 겨눈다 — mermaid의 임시 노드는 body에 살고,
// 문서 콘텐츠는 패널 안에 산다. 문서가 선점한 id를 지우면 사용자 콘텐츠가 사라진다.
function removeStrayNode(id: string, pane: HTMLElement): void {
  const node = document.getElementById(id);
  if (node !== null && !pane.contains(node)) {
    node.remove();
  }
}

function cacheKey(theme: string, code: string): string {
  return `${theme}\u0000${code}`;
}

/**
 * 프리뷰 DOM의 mermaid 플레이스홀더를 SVG로 채우고, 채울 때마다 리비전을 올린다.
 *
 * 리비전은 스크롤 동기화가 다시 측정해야 한다는 신호다 — 다이어그램은 **비동기로 도착해**
 * 블록 높이를 바꾸므로, 그 전에 잰 블록 위치는 낡은 값이 된다.
 */
export function useMermaid(paneRef: RefObject<HTMLElement | null>, html: string): number {
  const theme = useResolvedTheme();
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const pane = paneRef.current;
    if (pane === null) {
      return;
    }
    const placeholders = [...pane.querySelectorAll<HTMLElement>(`.${MERMAID_PLACEHOLDER_CLASS}`)];
    if (placeholders.length === 0) {
      return;
    }

    // 프리뷰가 다시 스왑되면(다음 타이핑) 이 실행은 낡은 DOM을 그린다 — 즉시 버린다.
    let cancelled = false;

    const paint = async () => {
      let mermaid: MermaidApi;
      try {
        mermaid = await loadMermaid();
      } catch {
        // 로드 실패 — 이 틱은 조용히 끝낸다(paint는 void 호출이라 여기서 안 잡으면
        // unhandled rejection이 된다). 실패는 캐시되지 않았으므로 다음 갱신이 재시도한다.
        return;
      }
      if (cancelled) {
        return;
      }
      // 테마는 매번 다시 지정한다 — 사용자가 테마를 바꾸면 같은 문서를 다른 색으로 그린다.
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: theme === "dark" ? "dark" : "default",
      });

      let painted = false;
      for (const placeholder of placeholders) {
        const encoded = placeholder.getAttribute(MERMAID_CODE_ATTR);
        if (encoded === null) {
          continue;
        }
        const id = nextRenderId();
        try {
          // 디코딩도 이 try 안이다. 문서는 원시 HTML을 통과시키므로 사용자가 플레이스홀더를
          // 흉내 낼 수 있고, 그 값이 퍼센트 인코딩이 아니면 디코딩이 예외를 던진다. 그 예외가
          // 루프를 뚫고 나가면 **뒤에 오는 멀쩡한 다이어그램이 통째로 안 그려진다** — 실패는
          // 언제나 그 플레이스홀더 하나에 가둔다.
          const code = decodeMermaidSource(encoded);
          const key = cacheKey(theme, code);
          const cached = svgCache.get(key);
          if (cached !== undefined) {
            placeholder.innerHTML = cached;
            painted = true;
            continue;
          }
          const { svg } = await mermaid.render(id, code);
          if (cancelled) {
            return;
          }
          cacheSvg(key, svg);
          placeholder.innerHTML = svg;
        } catch {
          // mermaid는 실패 시 임시 노드를 문서에 남긴다 — 우리가 치운다. 이름이 두 가지다:
          // 우리가 준 id 그대로인 것과, mermaid가 앞에 d를 붙여 만드는 것(#d<id>). 후자를
          // 놓치면 문법 오류를 고치는 동안 디바운스 틱마다 노드가 하나씩 샌다(실측).
          // **취소 판정보다 먼저 치운다** — 취소는 "낡은 DOM에 그리지 마라"지 "청소를
          // 건너뛰라"가 아니다. 깨진 다이어그램을 타이핑으로 고치는 동안은 매 틱이 취소라,
          // 취소 뒤에 치우면 같은 누수가 취소 경로로 되돌아온다.
          removeStrayNode(id, pane);
          removeStrayNode(`d${id}`, pane);
          if (cancelled) {
            return;
          }
          // 문법 오류는 사용자가 고칠 수 있는 일상이다 — 앱을 깨거나 배너를 띄우지 않고
          // 그 자리에만 알린다. 실패는 캐시하지 않는다(고치는 즉시 다시 시도해야 한다).
          placeholder.textContent = STRINGS.mermaidRenderError;
        }
        painted = true;
      }
      if (!cancelled && painted) {
        setRevision((current) => current + 1);
      }
    };

    void paint();

    return () => {
      cancelled = true;
    };
  }, [paneRef, html, theme]);

  return revision;
}
