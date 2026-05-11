// Hand-drawn 円相 (ensō) brand mark. Single decorative SVG, aria-hidden.

export function Enso({ size = 24 }: { size?: number }) {
  return (
    <svg
      className="enso"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M32 8c-13 0-24 11-24 24s11 24 24 24c12 0 22-9 23-21"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.85"
      />
      <path
        d="M53 28c-1-3-3-6-5-8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
}
