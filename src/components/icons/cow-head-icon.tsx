import type { SVGProps } from "react";

/**
 * Bull / cow head — face-on with horns.
 * Solid silhouette with eye & snout cutouts (evenodd).
 */
export function CowHeadIcon({
  className,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6.8 2.2c-.5-.4-1.25.05-1.1.7.4 1.85 1.45 3.35 2.55 4.3-.7.25-1.35.65-1.85 1.15C4.3 6.95 2.85 4.9 2.35 3.25c-.15-.55-.95-.5-1.05.1C.95 5.7 2 8.15 3.7 9.85c-.55.6-.9 1.4-1 2.25-.15 1.25.55 2.35 1.65 2.75.2 1.95 1.2 3.5 2.55 4.4V21c0 .55.45 1 1 1h8.2c.55 0 1-.45 1-1v-1.75c1.35-.9 2.35-2.45 2.55-4.4 1.1-.4 1.8-1.5 1.65-2.75-.1-.85-.45-1.65-1-2.25 1.7-1.7 2.75-4.15 2.4-6.5-.1-.6-.9-.65-1.05-.1-.5 1.65-1.95 3.7-4.05 5.1-.5-.5-1.15-.9-1.85-1.15 1.1-.95 2.15-2.45 2.55-4.3.15-.65-.6-1.1-1.1-.7-1.55 1.25-2.55 3.1-3.05 4.65C9.35 5.3 8.35 3.45 6.8 2.2ZM9.55 10.15a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm4.9 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2ZM12 12.85c-1.7 0-3 1.15-3 2.35s1.3 2.35 3 2.35 3-1.15 3-2.35-1.3-2.35-3-2.35Z"
      />
      <ellipse cx="10.85" cy="15.05" rx="0.42" ry="0.58" />
      <ellipse cx="13.15" cy="15.05" rx="0.42" ry="0.58" />
    </svg>
  );
}
