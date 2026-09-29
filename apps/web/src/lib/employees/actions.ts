"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import { checkAccess } from "@/lib/authz/guard";
import { privilegeRank } from "@/lib/catalog";
import { isSimpleStructure } from "@/lib/payroll/simple";
import { describeWeekdays, normaliseWeekdays } from "@/lib/attendance/calendar";
import { BLOOD_GROUPS } from "@/lib/employees/profile";
import { mediaPathOk } from "@/lib/media/bucket";
import { mediaExists, removeMedia } from "@/lib/media/urls";

/**
 * Employee records (MODULES.md → Employee Management).
 *
 * A membership IS the workforce record — attendance, leave, tasks and
 * payroll all point at it — so profile fields live there rather than in a
 * parallel "employee" table.
 *
 * This is where a person's home location and roaming capability are set,
 * which is what makes multi-location usable.
 */

export type ActionResult =
  | { ok: true; message: string; detail?: string }
  | { ok: false; error: string };

const profileSchema = z.object({
  membershipId: z.string().uuid(),
  displayName: z.string().trim().min(1, "Give the person a name.").max(120),
  employeeCode: z.string().trim().max(40).optional(),
  departmentId: z.string().uuid().nullable().optional(),
  bloodGroup: z.enum(BLOOD_GROUPS).nullable().optional(),
  joinedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
  branchId: z.string().uuid().nullable(),
  shiftId: z.string().uuid().nullable(),
  reportingToId: z.string().uuid().nullable(),
  canCheckInAtAnyBranch: z.boolean(),
  // INVITED is only ever kept, never chosen: it is what someone is until
  // they accept their invitation.
  status: z.enum(["ACTIVE", "SUSPENDED", "DEACTIVATED", "INVITED"]),
  hasOwnWeeklyOff: z.boolean().optional(),
  weeklyOffDays: z
    .array(z.number().int().min(0).max(6))
    .max(6, "Leave them at least one working day in the week.")
    .optional(),
});

export async function saveEmployeeAction(
  input: z.input<typeof profileSchema>,
): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the employee details.",
    };
  }

  const { session, decision } = await checkAccess({
    module: "EMPLOYEES",
    permission: "employees.manage",
  });
  if (!decision.allowed) {
    return { ok: false, error: decision.message ?? "You don't have access to this." };
  }

  const db = getDb();
  const membership = await db.tenantMembership.findFirst({
    where: { id: parsed.data.membershipId, tenantId: session.tenant.id },
    include: { user: true, branch: true, shift: true, department: true },
  });
  if (!membership) {
    return { ok: false, error: "That employee is no longer available." };
  }
  const departmentId =
    parsed.data.departmentId === undefined ? membership.departmentId : parsed.data.departmentId;

  // Every referenced record must belong to this tenant — the ids arrive
  // from a form (Constitution §2).
  for (const [label, id, check] of [
    [
      "location",
      parsed.data.branchId,
      () =>
        db.branch.count({
          where: { id: parsed.data.branchId!, tenantId: session.tenant.id },
        }),
    ],
    [
      "shift",
      parsed.data.shiftId,
      () =>
        db.shift.count({
          where: { id: parsed.data.shiftId!, tenantId: session.tenant.id },
        }),
    ],
    [
      "manager",
      parsed.data.reportingToId,
      () =>
        db.tenantMembership.count({
          where: {
            id: parsed.data.reportingToId!,
            tenantId: session.tenant.id,
          },
        }),
    ],
    [
      "department",
      departmentId,
      () =>
        db.department.count({
          where: { id: departmentId!, tenantId: session.tenant.id },
        }),
    ],
  ] as const) {
    if (id && (await check()) === 0) {
      return { ok: false, error: `That ${label} is no longer available.` };
    }
  }

  // Someone cannot report to themselves.
  if (parsed.data.reportingToId === membership.id) {
    return { ok: false, error: "A person cannot report to themselves." };
  }

  // An invited person becomes active by accepting, not by an edit: making
  // them "Active" here would put someone who has never signed in onto the
  // attendance board and into payroll. They can only stay invited or leave.
  const invited = membership.status === "INVITED";
  if (invited && !["INVITED", "DEACTIVATED"].includes(parsed.data.status)) {
    return {
      ok: false,
      error: "They haven't accepted their invitation yet. They become active when they do.",
    };
  }
  if (!invited && parsed.data.status === "INVITED") {
    return { ok: false, error: "Choose Active, Suspended or Has left." };
  }
  const hasOwnWeeklyOff = parsed.data.hasOwnWeeklyOff ?? membership.hasOwnWeeklyOff;
  const weeklyOffDays = hasOwnWeeklyOff
    ? normaliseWeekdays(parsed.data.weeklyOffDays ?? membership.weeklyOffDays)
    : [];

  const before = {
    displayName: membership.user.displayName,
    employeeCode: membership.employeeCode,
    department: membership.department?.name ?? null,
    bloodGroup: membership.bloodGroup,
    branch: membership.branch?.name ?? null,
    shift: membership.shift?.name ?? null,
    canCheckInAtAnyBranch: membership.canCheckInAtAnyBranch,
    status: membership.status,
    weeklyOff: membership.hasOwnWeeklyOff
      ? describeWeekdays(membership.weeklyOffDays)
      : "company default",
  };

  await db.$transaction([
    db.user.update({
      where: { id: membership.userId },
      data: { displayName: parsed.data.displayName },
    }),
    db.tenantMembership.update({
      where: { id: membership.id },
      data: {
        employeeCode: parsed.data.employeeCode || null,
        departmentId,
        bloodGroup:
          parsed.data.bloodGroup === undefined ? membership.bloodGroup : parsed.data.bloodGroup,
        joinedOn: parsed.data.joinedOn
          ? new Date(`${parsed.data.joinedOn}T00:00:00.000Z`)
          : null,
        branchId: parsed.data.branchId,
        shiftId: parsed.data.shiftId,
        reportingToId: parsed.data.reportingToId,
        canCheckInAtAnyBranch: parsed.data.canCheckInAtAnyBranch,
        status: parsed.data.status,
        hasOwnWeeklyOff,
        weeklyOffDays,
      },
    }),
  ]);

  const updated = await db.tenantMembership.findUniqueOrThrow({
    where: { id: membership.id },
    include: { branch: true, shift: true, department: true },
  });

  await recordAuditEvent(session, {
    action: "employee.updated",
    entityType: "tenant_membership",
    entityId: membership.id,
    before,
    after: {
      displayName: parsed.data.displayName,
      employeeCode: parsed.data.employeeCode || null,
      department: updated.department?.name ?? null,
      bloodGroup: updated.bloodGroup,
      branch: updated.branch?.name ?? null,
      shift: updated.shift?.name ?? null,
      canCheckInAtAnyBranch: parsed.data.canCheckInAtAnyBranch,
      status: parsed.data.status,
      weeklyOff: hasOwnWeeklyOff ? describeWeekdays(weeklyOffDays) : "company default",
    },
  });

  revalidatePath("/admin/employees");
  revalidatePath(`/admin/employees/${membership.id}`);

  const roamingChanged =
    membership.canCheckInAtAnyBranch !== parsed.data.canCheckInAtAnyBranch;

  return {
    ok: true,
    message: `${parsed.data.displayName} saved.`,
    detail: roamingChanged
      ? parsed.data.canCheckInAtAnyBranch
        ? "They can now check in at any of your locations."
        : "They can now only check in at their own location."
      : undefined,
  };
}

/**
 * Reveal a sensitive block (salary or bank details) — permission-checked
 * AND recorded. Constitution §7: sensitive data is never rendered inline
 * "just in case", and every access is logged.
 */
const revealSchema = z.object({
  membershipId: z.string().uuid(),
  kind: z.enum(["salary", "bank"]),
});

export type RevealResult =
  | { ok: true; lines: Array<{ label: string; value: string }> }
  | { ok: false; error: string };

export async function revealSensitiveAction(
  input: z.input<typeof revealSchema>,
): Promise<RevealResult> {
  const parsed = revealSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That could not be read." };

  const permission = parsed.data.kind === "salary" ? "payroll.view" : "bank.view";
  const { session, decision } = await checkAccess({
    module: parsed.data.kind === "salary" ? "PAYROLL" : "EMPLOYEES",
    permission,
  });
  if (!decision.allowed) {
    return {
      ok: false,
      error: decision.message ?? "You don't have access to this.",
    };
  }

  const db = getDb();
  const membership = await db.tenantMembership.findFirst({
    where: { id: parsed.data.membershipId, tenantId: session.tenant.id },
    include: { user: true },
  });
  if (!membership) {
    return { ok: false, error: "That employee is no longer available." };
  }

  // Logged BEFORE the value is returned, so an access is recorded even if
  // the caller drops the response.
  await recordAuditEvent(session, {
    action: `employee.${parsed.data.kind}_viewed`,
    entityType: "tenant_membership",
    entityId: membership.id,
    metadata: { employee: membership.user.displayName },
  });

  if (parsed.data.kind === "bank") {
    // Bank details are not collected in this version — say so plainly
    // rather than showing an empty block.
    return {
      ok: true,
      lines: [
        {
          label: "Bank details",
          value: "Not collected in this version.",
        },
      ],
    };
  }

  const structure = await db.salaryStructure.findFirst({
    where: { tenantId: session.tenant.id, membershipId: membership.id },
    orderBy: { effectiveFrom: "desc" },
    include: { lines: { include: { component: true } } },
  });

  if (!structure) {
    return {
      ok: true,
      lines: [{ label: "Salary", value: "Not set" }],
    };
  }

  // The simple one-line shape reads as the one fact it is. Listing
  // "Base amount" and a "Monthly salary" line with the same figure would
  // make one number look like two.
  if (isSimpleStructure(structure.lines)) {
    return {
      ok: true,
      lines: [
        {
          label: "Monthly salary",
          value: `₹${Number(structure.lines[0].amount).toLocaleString("en-IN")}`,
        },
        {
          label: "Effective from",
          value: structure.effectiveFrom.toISOString().slice(0, 10),
        },
      ],
    };
  }

  return {
    ok: true,
    lines: [
      {
        label: "Base amount",
        value: `₹${Number(structure.baseAmount).toLocaleString("en-IN")}`,
      },
      {
        label: "Effective from",
        value: structure.effectiveFrom.toISOString().slice(0, 10),
      },
      ...structure.lines.map((line) => ({
        label: line.component.name,
        value:
          line.component.calculation === "PERCENT_OF_BASE"
            ? `${Number(line.percent)}%`
            : `₹${Number(line.amount).toLocaleString("en-IN")}`,
      })),
    ],
  };
}

// ------------------------------------------------------ designation change

const designationChangeSchema = z.object({
  membershipId: z.string().uuid(),
  designationId: z.string().uuid("Choose a designation."),
  reason: z.string().trim().max(500).optional(),
});

/**
 * Give someone a different designation. The designation carries an access
 * level, so when that changes this is a change in what the person can SEE,
 * with the same four refusals it always had:
 *
 * 1. **Not your own access.** Otherwise an admin can quietly promote
 *    themselves, and the audit trail shows them approving it.
 * 2. **Not above your own rank.** Anyone who can add employees could
 *    otherwise mint an Owner — escalation dressed as ordinary admin work.
 * 3. **Not the last Owner.** A company must never be left with nobody who
 *    can manage it (edge-cases.md → "last owner").
 * 4. **Not another company's designation.** The id arrives from a form.
 *
 * A new title with the same access is just a title change.
 */
export async function changeEmployeeDesignationAction(
  input: z.input<typeof designationChangeSchema>,
): Promise<ActionResult> {
  const parsed = designationChangeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details." };
  }

  const { session, decision } = await checkAccess({
    module: "EMPLOYEES",
    permission: "employees.manage",
  });
  if (!decision.allowed) {
    return { ok: false, error: decision.message ?? "You don't have access to this." };
  }

  const db = getDb();
  const membership = await db.tenantMembership.findFirst({
    where: { id: parsed.data.membershipId, tenantId: session.tenant.id },
    include: { user: true, role: true },
  });
  if (!membership) return { ok: false, error: "That employee is no longer available." };

  const next = await db.designation.findFirst({
    where: { id: parsed.data.designationId, tenantId: session.tenant.id, isActive: true },
    include: { role: true },
  });
  if (!next) return { ok: false, error: "That designation is no longer available." };
  if (next.id === membership.designationId) {
    return { ok: false, error: `${membership.user.displayName} is already ${next.name}.` };
  }

  const accessChanges = next.roleId !== membership.roleId;
  const myRank = privilegeRank(session.membership.roleKey);
  if (accessChanges) {
    if (membership.userId === session.user.id) {
      return {
        ok: false,
        error: "You can't change your own access. Ask another owner or admin to do it.",
      };
    }
    if (privilegeRank(next.role.key) > myRank) {
      return {
        ok: false,
        error: `You can't give someone more access than you have. ${next.name} has ${next.role.name} access, which is above yours.`,
      };
    }
    if (privilegeRank(membership.role.key) > myRank) {
      return {
        ok: false,
        error: `${membership.user.displayName} has more access than you, so only someone above them can change it.`,
      };
    }
    // Losing the last owner locks everyone out of company management.
    if (membership.role.key === "OWNER" && next.role.key !== "OWNER") {
      const otherOwners = await db.tenantMembership.count({
        where: {
          tenantId: session.tenant.id,
          status: "ACTIVE",
          role: { key: "OWNER" },
          id: { not: membership.id },
        },
      });
      if (otherOwners === 0) {
        return {
          ok: false,
          error:
            "This is the only owner. Make someone else an owner first, or the company would be left with nobody who can manage it.",
        };
      }
    }
  }

  await db.tenantMembership.update({
    where: { id: membership.id },
    data: { designationId: next.id, designation: next.name, roleId: next.roleId },
  });

  await recordAuditEvent(session, {
    action: accessChanges ? "employee.role_changed" : "employee.designation_changed",
    entityType: "tenant_membership",
    entityId: membership.id,
    reason: parsed.data.reason,
    before: { designation: membership.designation, role: membership.role.key, roleName: membership.role.name },
    after: { designation: next.name, role: next.role.key, roleName: next.role.name },
    metadata: { employee: membership.user.displayName },
  });

  revalidatePath("/admin/employees");
  revalidatePath(`/admin/employees/${membership.id}`);

  if (!accessChanges) {
    return { ok: true, message: `${membership.user.displayName} is now ${next.name}.` };
  }
  const opensAdmin = privilegeRank(next.role.key) >= 2;
  return {
    ok: true,
    message: `${membership.user.displayName} is now ${next.name}, with ${next.role.name} access.`,
    detail: opensAdmin
      ? "They can open the admin area. It takes effect the next time they load a page."
      : "They see only their own records now. It takes effect the next time they load a page.",
  };
}

// ---------------------------------------------------------------- photo

const photoSchema = z.object({
  membershipId: z.string().uuid(),
  photoPath: z.string().max(200).nullable(),
});

/** Set or remove someone's photo. Saved straight away, like a document. */
export async function setEmployeePhotoAction(input: z.input<typeof photoSchema>): Promise<ActionResult> {
  const parsed = photoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That photo couldn't be saved." };
  const { session, decision } = await checkAccess({ module: "EMPLOYEES", permission: "employees.manage" });
  if (!decision.allowed) return { ok: false, error: decision.message ?? "You don't have access to this." };

  const db = getDb();
  const membership = await db.tenantMembership.findFirst({
    where: { id: parsed.data.membershipId, tenantId: session.tenant.id },
    include: { user: true },
  });
  if (!membership) return { ok: false, error: "That employee is no longer available." };
  const path = parsed.data.photoPath;
  if (path && (!mediaPathOk(path, session.tenant.id, "photos") || !(await mediaExists(path)))) {
    return { ok: false, error: "The photo didn't upload properly. Try again." };
  }

  await db.tenantMembership.update({ where: { id: membership.id }, data: { photoPath: path } });
  if (membership.photoPath && membership.photoPath !== path) await removeMedia([membership.photoPath]);
  await recordAuditEvent(session, {
    action: path ? "employee.photo_set" : "employee.photo_removed",
    entityType: "tenant_membership",
    entityId: membership.id,
    metadata: { employee: membership.user.displayName },
  });
  revalidatePath("/admin/employees");
  revalidatePath(`/admin/employees/${membership.id}`);
  return { ok: true, message: path ? "Photo saved." : "Photo removed." };
}
