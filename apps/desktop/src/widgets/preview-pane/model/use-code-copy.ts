import { type RefObject, useEffect, useRef, useState } from "react";

// 코드 복사의 위젯 쪽 재료 — 포털 대상 수집과 클립보드 쓰기
// (→ preview-strategy.md#코드-복사-버튼, 버튼 자체는 ui/copy-code-button.tsx).
//
// 프리뷰 내용은 React가 소유하지 않으므로(innerHTML 삽입, → preview-pane.tsx) 버튼은
// 포털로 각 코드 블록(pre)에 꽂는다. 내용 교체가 버튼을 지우면, 이 훅이 대상을 다시
// 수집해 포털이 다시 그려진다 — 다이어그램 SVG와 같은 "삽입 뒤 다시 붙는" 경로다.

export interface CodeBlockTarget {
  /** 포털 key — 내용 교체마다 새로 발급한다. 재사용하면 이전 버튼의 상태(복사됨)가
   * 새 DOM의 같은 자리 버튼으로 새어 들어간다. */
  key: string;
  element: HTMLElement;
}

/**
 * 프리뷰 내용의 코드 블록(pre>code)을 포털 대상으로 수집한다 — html이 바뀔 때마다
 * (= 내용 교체 뒤) 다시. 다이어그램 플레이스홀더는 pre가 아니라 걸리지 않고,
 * 인라인 코드는 pre 밖이라 걸리지 않는다.
 */
export function useCodeBlocks(
  contentRef: RefObject<HTMLElement | null>,
  html: string,
): CodeBlockTarget[] {
  const [targets, setTargets] = useState<CodeBlockTarget[]>([]);
  const swapSeqRef = useRef(0);

  useEffect(() => {
    const content = contentRef.current;
    if (content === null) {
      return;
    }
    swapSeqRef.current += 1;
    const swap = swapSeqRef.current;
    setTargets(
      [...content.querySelectorAll("pre")]
        .filter((pre) => pre.querySelector("code") !== null)
        .map((element, index) => ({ key: `${swap}-${index}`, element })),
    );
  }, [contentRef, html]);

  return targets;
}

function fallbackCopy(text: string): boolean {
  // execCommand("copy")는 현재 selection을 복사한다 — 원문을 임시 textarea에 실어 선택한다.
  const staging = document.createElement("textarea");
  staging.value = text;
  // 화면에 그리지 않는다. fixed라 스크롤 위치도 건드리지 않는다.
  staging.style.position = "fixed";
  staging.style.opacity = "0";
  document.body.append(staging);
  staging.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }
  staging.remove();
  return copied;
}

/**
 * 웹 표준 클립보드 API로 쓰고, 안 되면 execCommand("copy") 폴백으로 쓴다.
 *
 * 폴백을 두는 이유: 배포 빌드의 커스텀 프로토콜 origin이 secure context가 아닐 수 있다
 * (Tauri 클립보드 플러그인은 쓰지 않는다 — 권한·번들 증가 없음).
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  const clipboard = navigator.clipboard as Clipboard | undefined;
  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(text);
      return true;
    } catch {
      // API가 있어도 secure context가 아니면 거부된다 — 폴백으로 넘어간다.
    }
  }
  return fallbackCopy(text);
}
