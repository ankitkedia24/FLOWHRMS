import "server-only";

import { getDb } from "@/lib/db";
import type { Recipient } from "@/lib/actions/audience";
import { firstName } from "./state";

/**
 * Who hears about someone's trips (FIELD-VISITS-MODULE.md §4).
 *
 * Their reporting manager — by relationship, whatever that manager's role:
 * a team leader with no approval permission is still the person who needs
 * to know their field executive has gone out. With no reporting manager,
 * the head of their department. With neither, everyone who sees all field
 * visits (by default the owners and admins). Never the person themselves.
 */

export interface TripPerson {
  membershipId: string;
  userId: string;
  displayName: string;
  reportingToId: string | null;
  departmentId: string | null;
  departmentHeadId: string | null;
}

/** The person as the trip rules need them, from their membership. */
export async function loadTripPerson(tenantId: string, membershipId: string): Promise<TripPerson | null> {
  const m = await getDb().tenantMembership.findFirst({
    where: { id: membershipId, tenantId },
    select: {
      id: true,
      userId: true,
      reportingToId: true,
      departmentId: true,
      user: { select: { displayName: true } },
      department: { select: { headId: true, isActive: true } },
    },
  });
  if (!m) return null;
  return {
    membershipId: m.id,
    userId: m.userId,
    displayName: m.user.displayName,
    reportingToId: m.reportingToId,
    departmentId: m.departmentId,
    departmentHeadId: m.department?.isActive ? m.department.headId : null,
  };
}

export async function tripAudience(tenantId: string, person: TripPerson): Promise<Recipient[]> {
  const db = getDb();
  const first = firstName(person.displayName);

  if (person.reportingToId) {
    const manager = await db.tenantMembership.findFirst({
      where: { id: person.reportingToId, tenantId, status: "ACTIVE" },
      select: { userId: true },
    });
    if (manager && manager.userId !== person.userId) {
      return [{ userId: manager.userId, reason: `You are ${first}'s reporting manager.` }];
    }
  }

  if (person.departmentId) {
    const department = await db.department.findFirst({
      where: { id: person.departmentId, tenantId, isActive: true },
      select: { name: true, head: { select: { userId: true, status: true } } },
    });
    if (department?.head && department.head.status === "ACTIVE" && department.head.userId !== person.userId) {
      return [{ userId: department.head.userId, reason: `You are the head of ${department.name}.` }];
    }
  }

  const everyone = await db.tenantMembership.findMany({
    where: {
      tenantId,
      status: "ACTIVE",
      role: { permissions: { some: { permission: { key: "fieldvisits.view" } } } },
    },
    select: { userId: true },
  });
  return [...new Set(everyone.map((m) => m.userId))]
    .filter((userId) => userId !== person.userId)
    .map((userId) => ({
      userId,
      reason: `${first} has no reporting manager or department head, so this comes to you.`,
    }));
}
