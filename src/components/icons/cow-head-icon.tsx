import type { SVGProps } from "react";

/** Clean cattle-head mark for herd counts. */
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
      {/* Horns */}
      <path
        d="M8.2 9.2C6.4 7.2 5.2 4.8 5.5 3.6c.1-.4.6-.6 1-.4 1.3.6 2.4 2.2 3.1 3.6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15.8 9.2c1.8-2 3-4.4 2.7-5.6-.1-.4-.6-.6-1-.4-1.3.6-2.4 2.2-3.1 3.6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Ears */}
      <path
        d="M7.2 11.2c-1.4.2-2.4 1.2-2.6 2.4-.1.6.4 1.1 1 1 .8-.1 1.6-.7 2.1-1.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16.8 11.2c1.4.2 2.4 1.2 2.6 2.4.1.6-.4 1.1-1 1-.8-.1-1.6-.7-2.1-1.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Face */}
      <path
        d="M8.4 9.5c.9-1.5 2.1-2.3 3.6-2.3s2.7.8 3.6 2.3c.8 1.3 1 2.8.6 4.4-.5 2.1-2.1 3.8-4.2 3.8s-3.7-1.7-4.2-3.8c-.4-1.6-.2-3.1.6-4.4Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Eyes */}
      <circle cx="10.1" cy="11.6" r="0.85" fill="currentColor" />
      <circle cx="13.9" cy="11.6" r="0.85" fill="currentColor" />
      {/* Snout */}
      <ellipse
        cx="12"
        cy="15.1"
        rx="2.1"
        ry="1.55"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <circle cx="11.15" cy="15" r="0.35" fill="currentColor" />
      <circle cx="12.85" cy="15" r="0.35" fill="currentColor" />
    </svg>
  );
}
