import type { SVGProps } from "react";
const SvgSliders = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 8h8m6 0h2M4 16h4m6 0h6"
    />
    <circle cx={15} cy={8} r={2.5} stroke="currentColor" strokeWidth={2} />
    <circle cx={11} cy={16} r={2.5} stroke="currentColor" strokeWidth={2} />
  </svg>
);
export default SvgSliders;
