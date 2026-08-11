import type { SVGProps } from "react";
const SvgSun = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 25 25"
    aria-hidden="true"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      d="M12.023 1.76V1m0 22.046v-.76m10.263-10.263h.76M1 12.023h.76m17.52-7.257.538-.537M4.228 19.817l.537-.537m14.516 0 .537.537M4.228 4.23l.537.537m13.325 7.216a6.082 6.082 0 1 1-12.164 0 6.082 6.082 0 0 1 12.164 0Z"
    />
  </svg>
);
export default SvgSun;
