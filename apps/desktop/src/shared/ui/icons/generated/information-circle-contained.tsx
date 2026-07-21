import type { SVGProps } from "react";
const SvgInformationCircleContained = (props: SVGProps<SVGSVGElement>) => (
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
      d="M12 12v4.5m0-7.835v-.04M3 12a9 9 0 1 1 18 0 9 9 0 0 1-18 0"
    />
  </svg>
);
export default SvgInformationCircleContained;
