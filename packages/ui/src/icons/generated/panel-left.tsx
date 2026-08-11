import type { SVGProps } from "react";
const SvgPanelLeft = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
    {...props}
  >
    <path
      d="M9 3H4.973C3.883 3 3 3.883 3 4.973v14.054C3 20.117 3.883 21 4.973 21H9z"
      data-pane="true"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 3h10.027C20.117 3 21 3.883 21 4.973v14.054c0 1.09-.883 1.973-1.973 1.973H9M9 3H4.973C3.883 3 3 3.883 3 4.973v14.054C3 20.117 3.883 21 4.973 21H9M9 3v18"
    />
  </svg>
);
export default SvgPanelLeft;
