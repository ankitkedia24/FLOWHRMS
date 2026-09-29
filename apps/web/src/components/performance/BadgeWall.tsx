import { Award, Lock } from "lucide-react";
import type { EarnedBadge, LockedBadge } from "@/lib/performance/summary";


/**
 * The badge wall. Earned badges celebrate; locked ones are greyed WITH
 * exactly how to earn them (PERFORMANCE-MODULE.md §B) — a locked badge
 * with no instructions is a taunt, with them it is a goal.
 */
export function BadgeWall({
  earned,
  locked,
}: {
  earned: EarnedBadge[];
  locked: LockedBadge[];
}) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {earned.map((badge) => (
        <li
          key={badge.key}
          className="flex flex-col items-center gap-2 rounded-surface-card border border-border-default bg-surface-default p-4 text-center"
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-[color:var(--fh-color-brand-primary-subtle)]">
            <Award aria-hidden="true" className="size-6 text-brand-primary" />
          </span>
          <p className="font-heading text-label text-text-primary">{badge.name}</p>
          <p className="text-caption text-text-secondary">{badge.earnedLine}</p>
          {/* Opens the PNG; the person saves and forwards it themselves.
              Sharing is THEIR act — the product never posts anywhere. */}
          <a
            href={`/performance/badges/${badge.key}/card`}
            target="_blank"
            rel="noopener"
            className="text-caption font-semibold text-brand-primary underline-offset-2 hover:underline"
          >
            Share card
          </a>
        </li>
      ))}
      {locked.map((badge) => (
        <li
          key={badge.key}
          className="flex flex-col items-center gap-2 rounded-surface-card border border-dashed border-border-default bg-surface-sunken p-4 text-center"
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-surface-default">
            <Lock aria-hidden="true" className="size-5 text-text-tertiary" />
          </span>
          <p className="font-heading text-label text-text-secondary">{badge.name}</p>
          <p className="text-caption text-text-tertiary">{badge.howToEarn}</p>
        </li>
      ))}
    </ul>
  );
}
