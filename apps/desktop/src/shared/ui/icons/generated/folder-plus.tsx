import type { SVGProps } from "react";
const SvgFolderPlus = (props: SVGProps<SVGSVGElement>) => (
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
      d="M12.103 19.515h-7.8a2.4 2.4 0 0 1-2.4-2.4V4.832a1.2 1.2 0 0 1 1.2-1.2h5.718l2.765 2.954h8.317a1.2 1.2 0 0 1 1.2 1.2v3.188m-2.4 9.394v-3.394m0 0v-3.395m0 3.395h-3.394m3.394 0h3.394"
    />
  </svg>
);
export default SvgFolderPlus;
