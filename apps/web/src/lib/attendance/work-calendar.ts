import "server-only";

import { getDb } from "@/lib/db";
import { getPolicy, getPolicyVersion } from "@/lib/policies";
import {
  dateKey,
  normaliseWorkCalendar,
  offDayOn,
  personWeeklyOff,
  type WorkCalendar,
} from "./calendar";

/** The company's current work calendar; Sunday off when never saved. */
export async function loadWorkCalendar(tenantId: string): Promise<WorkCalendar> {
  return normaliseWorkCalendar(await getPolicy<unknown>(tenantId, "work_calendar"));
}

export async function loadWorkCalendarVersion(tenantId: string): Promise<number> {
  return getPolicyVersion(tenantId, "work_calendar");
}

/**
 * Who in the company is off today — a holiday, or their weekly off. The
 * "Not recorded" count leaves these people out: nobody is missing a
 * check-in on their day off.
 */
export async function membersOffOn(
  tenantId: string,
  workDate: Date,
  where: { branchId?: string } = {},
): Promise<Set<string>> {
  const calendar = await loadWorkCalendar(tenantId);
  const members = await getDb().tenantMembership.findMany({
    where: { tenantId, status: "ACTIVE", ...where },
    select: { id: true, hasOwnWeeklyOff: true, weeklyOffDays: true },
  });
  const key = dateKey(workDate);
  return new Set(
    members
      .filter((m) => offDayOn(key, calendar, personWeeklyOff(calendar, m)))
      .map((m) => m.id),
  );
}
