import type { SVGProps } from "react";
const SvgEdit = (props: SVGProps<SVGSVGElement>) => (
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
      d="m12.536 19.243.743-.832a2.062 2.062 0 0 1 3.279.266 2.062 2.062 0 0 0 3.117.428l1.346-1.208M2.979 19.47l4.366-.88a1.2 1.2 0 0 0 .611-.328l9.774-9.779a1.2 1.2 0 0 0 0-1.697l-2.071-2.068a1.2 1.2 0 0 0-1.697 0l-9.774 9.78a1.2 1.2 0 0 0-.328.611z"
    />
  </svg>
);
export default SvgEdit;
