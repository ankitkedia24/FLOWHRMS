import "server-only";

import type { AppSession } from "@/lib/auth/types";
import { getDb } from "@/lib/db";
import { ROLE_CONSEQUENCE, ROLE_PICKER_ORDER, privilegeRank } from "@/lib/catalog";
import { companyDefaultShiftLabel } from "@/lib/attendance/shifts";
import { getPolicy } from "@/lib/policies";

/**
 * Everything the Add employee and Edit employee forms offer, and what the
 * signed-in person may create on the spot. One loader, so the two forms
 * can never offer different things.
 */

export interface DesignationOption {
  value: string;
  label: string;
  roleId: string;
  roleName: string;
  /** One line on what this access level can see and do. */
  consequence: string;
  /** More access than the signed-in person has: shown, but refused. */
  aboveYou: boolean;
}

export interface AccessLevelOption {
  value: string;
  label: string;
  consequence: string;
  aboveYou: boolean;
}

export interface EmployeeFormOptions {
  designations: DesignationOption[];
  accessLevels: AccessLevelOption[];
  departments: Array<{ value: string; label: string }>;
  branches: Array<{ value: string; label: string }>;
  shifts: Array<{ value: string; label: string }>;
  defaultShiftLabel: string;
  /** The company's permitted-area radius, for the location picker's circle. */
  defaultRadiusM: number;
  can: { addDepartment: boolean; addLocation: boolean; addShift: boolean; addDesignation: boolean };
}

const rank = (key: string) => {
  const i = ROLE_PICKER_ORDER.indexOf(key);
  return i === -1 ? ROLE_PICKER_ORDER.length : i;
};

export async function loadEmployeeFormOptions(session: AppSession): Promise<EmployeeFormOptions> {
  const db = getDb();
  const tenantId = session.tenant.id;
  const [designations, roles, departments, branches, shifts, attendancePolicy] = await Promise.all([
    db.designation.findMany({ where: { tenantId, isActive: true }, include: { role: true } }),
    db.role.findMany({ where: { tenantId } }),
    db.department.findMany({ where: { tenantId, isActive: true }, orderBy: { name: "asc" } }),
    db.branch.findMany({ where: { tenantId, isActive: true }, orderBy: { name: "asc" } }),
    db.shift.findMany({ where: { tenantId }, orderBy: { startMinutes: "asc" } }),
    getPolicy<{ radiusM?: number }>(tenantId, "attendance").catch(() => null),
  ]);
  const myRank = privilegeRank(session.membership.roleKey);

  return {
    // Least access first, then A–Z: a picker that grants access must never
    // default to a powerful choice.
    designations: designations
      .sort((a, b) => rank(a.role.key) - rank(b.role.key) || a.name.localeCompare(b.name))
      .map((d) => ({
        value: d.id,
        label: d.name,
        roleId: d.roleId,
        roleName: d.role.name,
        consequence: ROLE_CONSEQUENCE[d.role.key] ?? "Decides what they can see and do.",
        aboveYou: privilegeRank(d.role.key) > myRank,
      })),
    accessLevels: roles
      .sort((a, b) => rank(a.key) - rank(b.key))
      .map((r) => ({
        value: r.id,
        label: r.name,
        consequence: ROLE_CONSEQUENCE[r.key] ?? "",
        aboveYou: privilegeRank(r.key) > myRank,
      })),
    departments: departments.map((d) => ({ value: d.id, label: d.name })),
    branches: branches.map((b) => ({ value: b.id, label: b.name })),
    shifts: shifts.map((s) => ({ value: s.id, label: s.name })),
    defaultShiftLabel: companyDefaultShiftLabel(shifts),
    defaultRadiusM: radiusFrom(attendancePolicy),
    can: {
      addDepartment: session.permissions.has("settings.manage"),
      addLocation: session.permissions.has("settings.manage"),
      addShift: session.permissions.has("policy.edit"),
      addDesignation: session.permissions.has("employees.manage"),
    },
  };
}

function radiusFrom(policy: { radiusM?: number } | null): number {
  const r = Number(policy?.radiusM);
  // The attendance settings screen falls back to 300 m too.
  return Number.isFinite(r) && r > 0 ? r : 300;
}
