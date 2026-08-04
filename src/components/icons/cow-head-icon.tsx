import type { SVGProps } from "react";

/** Simple cow-head mark for herd counts (not a people icon). */
export function CowHeadIcon({
  className,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
      {...props}
    >
      <path
        d="M7.5 8.5c-1.8-.9-3.2-2.6-3.5-3.8-.1-.5.3-1  .8-.9 1.2.3 2.4 1.4 3.2 2.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M16.5 8.5c1.8-.9 3.2-2.6 3.5-3.8.1-.5-.3-1-.8-.9-1.2.3-2.4 1.4-3.2 2.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M8 9.2c.8-1.4 2.2-2.2 4-2.2s3.2.8 4 2.2c.7 1.2.9 2.6.6 4.1-.4 2.2-2 4.1-4.6 4.1s-4.2-1.9-4.6-4.1c-.3-1.5-.1-2.9.6-4.1Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="9.6" cy="11.2" r="0.7" fill="currentColor" />
      <circle cx="14.4" cy="11.2" r="0.7" fill="currentColor" />
      <path
        d="M10.4 14.2c.5.5 1.1.8 1.6.8s1.1-.3 1.6-.8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M9.2 16.8c.7.9 1.7 1.4 2.8 1.4s2.1-.5 2.8-1.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
