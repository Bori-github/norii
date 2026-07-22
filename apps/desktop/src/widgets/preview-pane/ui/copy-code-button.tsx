import { type MouseEvent, useEffect, useRef, useState } from "react";
import { css, cx } from "styled-system/css";

import { STRINGS } from "@shared/config";
import { CheckIcon, CopyRightIcon } from "@shared/ui";

import { copyTextToClipboard } from "../model/use-code-copy";

// 코드 복사 버튼 — 파서가 아니라 이 위젯이 프리뷰 DOM에 붙이는 UI다
// (→ preview-strategy.md#코드-복사-버튼). `.md`에는 아무것도 남지 않는다.
// 프리뷰 내용은 React 소유가 아니므로 이 컴포넌트는 **포털**로 각 pre에 꽂힌다
// (→ use-code-copy.ts). 아이콘·복사됨 상태·타이머는 React가 관리한다.

/** 노출 조건(preview-pane의 pre:hover 규칙)과 테스트가 이 클래스로 버튼을 찾는다. */
export const COPY_BUTTON_CLASS = "norii-copy-button";

/** 복사 피드백(체크 아이콘)이 원래 아이콘으로 돌아가기까지의 시간. */
const COPY_FEEDBACK_MS = 1500;

// 노출 조건(pre:hover 시 opacity 1)과 기준점(pre의 position: relative)은 preview-pane에
// 있다 — 파서 DOM인 pre에 걸어야 해서 여기서는 표현할 수 없다.
const buttonClass = css({
  position: "absolute",
  top: "2",
  right: "2",
  // 평소에는 투명하다(읽는 동안에는 화면에 없다) — 노출은 pre:hover(패널 쪽)·키보드
  // 포커스·복사됨 상태가 되살린다.
  opacity: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  bg: "bg.paper",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "sm",
  padding: "1",
  color: "text.muted",
  cursor: "pointer",
  _hover: { color: "text" },
  _focusVisible: {
    opacity: 1,
    outline: "2px solid",
    outlineColor: "accent",
    outlineOffset: "2px",
  },
  // 복사 직후 — 체크 아이콘은 액센트로 뜨고(아이콘은 글자가 아니라 허용, → decisions/color-palette),
  // 포인터가 떠나도 피드백이 끝날 때까지는 보인다.
  "&[data-copied]": { opacity: 1, color: "accent" },
  // 아이콘 크기는 소비 측 CSS가 정한다 — 생성된 svg에는 width/height가 없다(viewBox만).
  "& svg": { width: "4", height: "4" },
});

export function CopyCodeButton() {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 되돌림 타이머는 버튼과 함께 죽는다 — 언마운트 뒤 setState를 남기지 않는다.
  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    },
    [],
  );

  const handleClick = (event: MouseEvent<HTMLButtonElement>): void => {
    // 이 클릭은 복사로 끝난다 — 패널의 링크 핸들러까지 올라가지 않는다.
    event.stopPropagation();
    // 복사되는 것은 렌더 장식이 아니라 코드 블록의 원문이다. 현재 렌더는 code 요소의
    // 텍스트가 곧 펜스 원문이다(하이라이트 도입 시에도 텍스트는 불변이다). 펜스 렌더가
    // 붙이는 꼬리 개행 하나만 걷어낸다.
    const code = event.currentTarget.closest("pre")?.querySelector("code");
    if (!code) {
      return;
    }
    const source = (code.textContent ?? "").replace(/\n$/, "");
    void copyTextToClipboard(source).then((copiedOk) => {
      if (!copiedOk) {
        return;
      }
      setCopied(true);
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
    });
  };

  return (
    // 아이콘은 장식(aria-hidden)이고 이름은 aria-label이 진다 — 피드백("복사됨")을
    // 스크린리더도 듣는다(aria-live). data-copied는 CSS·테스트의 상태 판별 기준이다.
    // 스크롤 동기화의 라인 꼬리표(data-source-line)는 달지 않는다 — 매핑 테이블 오염 방지.
    <button
      type="button"
      className={cx(COPY_BUTTON_CLASS, buttonClass)}
      aria-label={copied ? STRINGS.copyCodeDoneText : STRINGS.copyCodeLabel}
      aria-live="polite"
      data-copied={copied ? "true" : undefined}
      onClick={handleClick}
    >
      {copied ? <CheckIcon /> : <CopyRightIcon />}
    </button>
  );
}
