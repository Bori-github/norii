import type { SVGProps } from "react";

// 앱 공용 스트로크 아이콘 — 색은 currentColor, 크기는 쓰는 쪽 CSS가 정한다(viewBox만 고정).
// 아이콘은 장식이다 — 이름(aria-label)은 아이콘을 품는 컨트롤이 진다.

export function CopyRightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M20 13.1251L20 6.00003C20 4.34317 18.6568 3.00002 17 3.00004L9.875 3.00012M14 21.0001L7.25 21.0001C6.00736 21.0001 5 19.9928 5 18.7501L5 9.00012C5 7.75748 6.00736 6.75012 7.25 6.75012L14 6.75012C15.2426 6.75011 16.25 7.75748 16.25 9.00012L16.25 18.7501C16.25 19.9928 15.2426 21.0001 14 21.0001Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M16.8 8.3999L9.64043 15.5999L7.19995 13.1456"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
