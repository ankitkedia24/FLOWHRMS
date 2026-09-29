/**
 * Snooze options for an action tile.
 *
 * Snooze exists because the alternative is worse: without it people dismiss
 * a decision they meant to make, and FlowHRMS forgets. With it, the promise is
 * explicit — "ask me again at 6" — and survives a restart because it is a
 * stored timestamp, not a bit of component state.
 *
 * Every option carries the resolved wall-clock time in its label. "Later"
 * is not an answer; "This evening (6:00 pm)" is (voice-and-microcopy §10).
 *
 * Pure: takes `now` and a timezone, returns times. No I/O, no Date.now().
 */

export interface SnoozeOption {
  key: string;
  /** What the button says, including the resolved time. */
  label: string;
  until: Date;
}

const MINUTE = 60 * 1000;

/** Wall-clock hour/minute in a timezone, without pulling in a date library. */
function localParts(
  at: Date,
  timeZone: string,
): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).formatToParts(at);
  return {
    hour: Number(parts.find((p) => p.type === "hour")?.value ?? "0"),
    minute: Number(parts.find((p) => p.type === "minute")?.value ?? "0"),
  };
}

/**
 * The next moment at which the tenant-local clock reads `hour:00`, strictly
 * after `from`. Works by measuring the offset to the target and stepping a
 * day if it has passed — no timezone table needed, and DST-safe because the
 * offset is recomputed after the step.
 */
export function nextLocalHour(from: Date, timeZone: string, hour: number): Date {
  const { hour: h, minute: m } = localParts(from, timeZone);
  let deltaMinutes = hour * 60 - (h * 60 + m);
  if (deltaMinutes <= 0) deltaMinutes += 24 * 60;
  const candidate = new Date(from.getTime() + deltaMinutes * MINUTE);

  // Re-check: a DST shift between now and then moves the wall clock.
  const drift = localParts(candidate, timeZone).hour - hour;
  if (drift !== 0 && Math.abs(drift) <= 2) {
    return new Date(candidate.getTime() - drift * 60 * MINUTE);
  }
  return candidate;
}

export function formatSnoozeTime(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  })
    .format(at)
    .replace(/\s?([ap])\.?m\.?/i, (_, p: string) => ` ${p.toLowerCase()}m`);
}

/**
 * The four choices offered. Deliberately few — a menu of twelve durations is
 * a decision in itself, and the point of snoozing is to not decide now.
 */
export function snoozeOptions(now: Date, timeZone: string): SnoozeOption[] {
  const evening = nextLocalHour(now, timeZone, 18);
  const morning = nextLocalHour(now, timeZone, 9);
  const eveningIsToday =
    evening.getTime() - now.getTime() <= 12 * 60 * MINUTE;

  return [
    {
      key: "15m",
      label: "15 minutes",
      until: new Date(now.getTime() + 15 * MINUTE),
    },
    {
      key: "1h",
      label: "1 hour",
      until: new Date(now.getTime() + 60 * MINUTE),
    },
    {
      key: "evening",
      label: `${eveningIsToday ? "This evening" : "Tomorrow evening"} (${formatSnoozeTime(evening, timeZone)})`,
      until: evening,
    },
    {
      key: "morning",
      label: `Tomorrow morning (${formatSnoozeTime(morning, timeZone)})`,
      until: morning,
    },
  ];
}

export function resolveSnoozeOption(
  key: string,
  now: Date,
  timeZone: string,
): SnoozeOption | null {
  return snoozeOptions(now, timeZone).find((o) => o.key === key) ?? null;
}

/**
 * A snooze must not outlive the decision. Ten snoozes is not a scheduling
 * preference, it is an unmade decision — after this the tile stays put and
 * says so, rather than letting someone push a leave request past the date
 * it was requested for.
 */
export const MAX_SNOOZES = 5;

export function canSnooze(snoozeCount: number): {
  allowed: boolean;
  reason?: string;
} {
  if (snoozeCount >= MAX_SNOOZES) {
    return {
      allowed: false,
      reason: `Snoozed ${MAX_SNOOZES} times. This one needs a decision.`,
    };
  }
  return { allowed: true };
}

/** Is this tile visible to this person right now? */
export function isTileVisible(
  recipient: { snoozedUntil?: Date | null },
  now: Date,
): boolean {
  if (!recipient.snoozedUntil) return true;
  return recipient.snoozedUntil.getTime() <= now.getTime();
}
