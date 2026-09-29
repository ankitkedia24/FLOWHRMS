/**
 * Shift display helpers — pure, shared by the settings page and the
 * employee forms so "Company default" always says what it means.
 */

/** Used when a company has no default shift yet (src/lib/attendance/service.ts). */
export const BUILT_IN_SHIFT = {
  name: "General shift",
  startMinutes: 9 * 60 + 30,
  endMinutes: 18 * 60 + 30,
  graceMinutes: 10,
} as const;

function hhmm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "10:00–20:00" */
export function formatShiftRange(startMinutes: number, endMinutes: number): string {
  return `${hhmm(startMinutes)}–${hhmm(endMinutes)}`;
}

/**
 * The label for "no shift of their own": which shift that actually is.
 * "Company default (Shop shift, 10:00–20:00)" or, before any shift is made
 * the default, "Company default (09:30–18:30)".
 */
export function companyDefaultShiftLabel(
  shifts: ReadonlyArray<{
    name: string;
    startMinutes: number;
    endMinutes: number;
    isDefault: boolean;
  }>,
): string {
  const def = shifts.find((s) => s.isDefault);
  return def
    ? `Company default (${def.name}, ${formatShiftRange(def.startMinutes, def.endMinutes)})`
    : `Company default (${formatShiftRange(BUILT_IN_SHIFT.startMinutes, BUILT_IN_SHIFT.endMinutes)})`;
}
