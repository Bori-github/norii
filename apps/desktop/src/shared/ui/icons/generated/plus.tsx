import type { SVGProps } from "react";
const SvgPlus = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
    {...props}
  >
    <path stroke="currentColor" strokeLinecap="round" strokeWidth={2} d="M12 6v12m6-6H6" />
  </svg>
);
export default SvgPlus;
