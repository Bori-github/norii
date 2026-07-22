import type { SVGProps } from "react";
const SvgFileEye = (props: SVGProps<SVGSVGElement>) => (
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
      d="M10.8 21.6h-6a2.4 2.4 0 0 1-2.4-2.4V4.8a2.4 2.4 0 0 1 2.4-2.4h10.8A2.4 2.4 0 0 1 18 4.8v4.8m-.6 7.75v-.064M6.6 7.2h7.2m-7.2 3.6h7.2m-7.2 3.6h3.6m11.4 3s-.996 2.94-4.2 2.889-4.2-2.889-4.2-2.889.956-2.99 4.2-2.99 4.2 2.99 4.2 2.99"
    />
  </svg>
);
export default SvgFileEye;
