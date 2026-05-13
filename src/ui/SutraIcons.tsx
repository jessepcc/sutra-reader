// Hand-drawn brush marks for the 常誦 shortcuts.
// Each icon is a single zen brush gesture (1–3 strokes) on a 64×64 grid,
// using currentColor so it inherits the muted/ink palette like the Enso.
// CSS classes on key elements drive subtle infinite animations defined in
// global.css (gated by prefers-reduced-motion).

interface IconProps {
  size?: number;
}

function frame({
  size = 32,
  className,
  children,
}: {
  size?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {children}
    </svg>
  );
}

// 心 — single closed brush curve in the shape of a heart radical (a bowl).
export function HeartSutraIcon(props: IconProps) {
  return frame({
    ...props,
    className: "anim-heart",
    children: (
      <path
        d="M16 26c0-6 5-10 9-7 2 1 4 1 6-1 4-3 9 1 9 7 0 9-12 18-12 18S16 35 16 26z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.88"
      />
    ),
  });
}

// 普門品 — willow branch (柳枝) symbolising Guanyin: a slow vertical stroke
// with two hanging leaf strokes.
export function GuanyinIcon(props: IconProps) {
  return frame({
    ...props,
    children: (
      <>
        <path
          d="M30 8c0 12 1 24 3 34 1 7 3 12 5 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.88"
        />
        <path
          className="anim-willow-l"
          d="M29 20c-5 1-10 5-13 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.5"
        />
        <path
          className="anim-willow-r"
          d="M33 34c5 1 10 4 14 9"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.5"
        />
      </>
    ),
  });
}

// 阿彌陀經 — lotus petal (蓮華) opening upward toward the Western Pure Land.
export function AmitabhaIcon(props: IconProps) {
  return frame({
    ...props,
    className: "anim-lotus",
    children: (
      <>
        <path
          d="M32 12c-10 8-14 22-14 32h28c0-10-4-24-14-32z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.88"
        />
        <path
          d="M32 20v18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity="0.45"
        />
      </>
    ),
  });
}

// 藥師經 — herb leaf with central vein, alluding to the healing 藥草 motif.
export function MedicineIcon(props: IconProps) {
  return frame({
    ...props,
    className: "anim-leaf",
    children: (
      <>
        <path
          d="M16 50c0-18 8-32 32-38-2 18-10 32-32 38z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.88"
        />
        <path
          d="M22 46c8-6 14-14 20-26"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity="0.45"
        />
      </>
    ),
  });
}

// 金剛經 — vajra (金剛杵): a vertical haft with two diagonals.
export function DiamondIcon(props: IconProps) {
  return frame({
    ...props,
    children: (
      <>
        <path
          d="M32 8v48"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.88"
        />
        <path
          className="anim-vajra"
          d="M20 20l24 24M44 20L20 44"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.55"
        />
      </>
    ),
  });
}

// 地藏經 — 錫杖 (khakkhara, monastic staff) with the topmost ring,
// the iconic attribute of Ksitigarbha.
export function KsitigarbhaIcon(props: IconProps) {
  return frame({
    ...props,
    children: (
      <>
        <path
          d="M32 20v36"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.88"
        />
        <circle
          className="anim-staff-ring"
          cx="32"
          cy="14"
          r="7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          opacity="0.6"
        />
        <path
          d="M27 56h10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.45"
        />
      </>
    ),
  });
}

export const SUTRA_ICONS: Record<string, (p: IconProps) => JSX.Element> = {
  heart: HeartSutraIcon,
  guanyin: GuanyinIcon,
  amitabha: AmitabhaIcon,
  medicine: MedicineIcon,
  diamond: DiamondIcon,
  ksitigarbha: KsitigarbhaIcon,
};
