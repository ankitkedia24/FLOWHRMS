import { Flame } from "lucide-react";

/**
 * The streak flame. Status is text plus colour, never colour alone: the
 * count and the word "streak" carry the meaning; the flame carries the
 * feeling. A zero-day streak shows muted with encouragement rather than
 * hiding — an empty slot says "this exists and is yours to light".
 */
export function StreakFlame({
  days,
  compact = false,
}: {
  days: number;
  compact?: boolean;
}) {
  const lit = days > 0;
  return (
    <div className="flex items-center gap-2">
      <span
        className={
        lit
            ? "flex size-9 items-center justify-center rounded-full bg-[color:var(--fh-color-status-warning-bg)]"
            : "flex size-9 items-center justify-center rounded-full bg-surface-sunken"
        }
      >
        <Flame
          aria-hidden="true"
          className={lit ? "size-5 text-status-warning-fg" : "size-5 text-text-tertiary"}
        />
      </span>
      <div className="min-w-0">
        <p className="font-mono text-data font-semibold text-text-primary tabular-nums">
          {days} day{days === 1 ? "" : "s"}
        </p>
        {!compact && (
          <p className="text-caption text-text-secondary">
            {lit ? "on-time streak" : "streak — light it with an on-time day"}
          </p>
        )}
      </div>
    </div>
  );
}
