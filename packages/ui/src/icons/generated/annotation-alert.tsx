import type { SVGProps } from "react";
const SvgAnnotationAlert = (props: SVGProps<SVGSVGElement>) => (
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
      d="M12 6.375V9.75m0 3.375v-.085m2.446 3.264L12 21l-2.25-4.696h-4.5A2.25 2.25 0 0 1 3 14.054V5.25A2.25 2.25 0 0 1 5.25 3h13.5A2.25 2.25 0 0 1 21 5.25v8.804a2.25 2.25 0 0 1-2.25 2.25z"
    />
  </svg>
);
export default SvgAnnotationAlert;
