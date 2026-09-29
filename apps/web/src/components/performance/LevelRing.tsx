import type { LevelStanding } from "@/lib/performance/levels";

/**
 * The level progress ring — inline SVG on tokens, no chart library
 * (PERFORMANCE-MODULE.md §1.9).
 *
 * The sweep animates in with CSS under motion-safe; the NUMBER does not
 * animate (D-017: numbers appear at final value — a figure that counts up
 * invites doubt about where it stopped).
 */
export function LevelRing({
  level,
  totalPoints,
  size = 132,
}: {
  level: LevelStanding;
  totalPoints: number;
  size?: number;
}) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const sweep = circumference * level.progress;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--fh-color-border-subtle)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--fh-color-brand-primary)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${sweep} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="motion-safe:[transition:stroke-dasharray_.9s_cubic-bezier(.2,.8,.2,1)]"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-mono text-data-lg font-semibold text-text-primary tabular-nums">
          {totalPoints.toLocaleString("en-IN")}
        </span>
        <span className="text-caption font-semibold text-brand-primary">{level.name}</span>
      </div>
    </div>
  );
}
