"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import { checkAccess } from "@/lib/authz/guard";
import { getSupabaseAdmin, ADMIN_KEY_MISSING } from "@/lib/supabase/admin";
import { privilegeRank } from "@/lib/catalog";
import { BLOOD_GROUPS } from "@/lib/employees/profile";
import { mediaExists } from "@/lib/media/urls";
import { mediaPathOk } from "@/lib/media/bucket";
import { deliverInvite, type InviteDelivery } from "./deliver";
import {
  INVITE_HELD_REASON,
  invitationsHeld,
  canResendInvite,
  describeClash,
  normaliseEmail,
  normaliseEmployeeCode,
  normaliseMobile,
} from "./policy";

/**
 * Employee invitation and onboarding.
 *
 * The chain, and where each link is enforced:
 *
 *   admin invites   → permission + module checked server-side (checkAccess)
 *   identity        → duplicates rejected without leaking other tenants
 *   auth account    → created with the SECRET key, server-only
 *   invitation      → random token; only its hash is stored
 *   email           → sent by us; failure surfaces the link instead
 *   employee opens  → token proves identity, they choose a password
 *   membership      → INVITED becomes ACTIVE, role already assigned
 *
 * Every step writes an audit event, and every query is filtered by
 * `session.tenant.id` — never by an id that arrived from the browser.
 */

export type ActionResult =
  | { ok: true; message: string; detail?: string; inviteLink?: string }
  | { ok: false; error: string; inviteLink?: string };

const EMPLOYMENT_TYPES = [
  "FULL_TIME",
  "PART_TIME",
  "CONTRACT",
  "TEMPORARY",
  "APPRENTICE",
] as const;

const inviteSchema = z.object({
  displayName: z.string().trim().min(1, "Enter the person's name.").max(120),
  mobile: z.string().trim().min(1, "Enter a mobile number."),
  email: z.string().trim().max(200).optional().or(z.literal("")),
  employeeCode: z.string().trim().max(40).optional().or(z.literal("")),
  departmentId: z.string().uuid().nullable().optional(),
  reportingToId: z.string().uuid().nullable().optional(),
  joinedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-08-10.")
    .optional()
    .or(z.literal("")),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  /** The designation decides both the job title and the access level. */
  designationId: z.string().uuid("Choose a designation."),
  branchId: z.string().uuid().nullable().optional(),
  shiftId: z.string().uuid().nullable().optional(),
  /** Uploaded by the browser to company-media/<tenant>/photos/ first. */
  photoPath: z.string().max(200).nullable().optional(),
  bloodGroup: z.enum(BLOOD_GROUPS).nullable().optional(),
});

// --------------------------------------------------------------- invite

export async function inviteEmployeeAction(
  input: z.input<typeof inviteSchema>,
): Promise<ActionResult> {
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const data = parsed.data;

  const { session, decision } = await checkAccess({
    module: "EMPLOYEES",
    permission: "employees.manage",
  });
  if (!decision.allowed) {
    return { ok: false, error: decision.message ?? "You don't have access to this." };
  }

  const mobile = normaliseMobile(data.mobile);
  if (!mobile.ok) return { ok: false, error: mobile.error };
  const email = data.email ? normaliseEmail(data.email) : null;
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: "That email address doesn't look right." };
  }
  const employeeCode = data.employeeCode
    ? normaliseEmployeeCode(data.employeeCode)
    : null;

  const db = getDb();
  const tenantId = session.tenant.id;

  // Everything referenced must belong to this tenant. The ids come from a
  // form and are therefore untrusted (Product Constitution §2).
  const designation = await db.designation.findFirst({
    where: { id: data.designationId, tenantId, isActive: true },
    include: { role: true },
  });
  if (!designation) return { ok: false, error: "That designation is no longer available." };
  const role = designation.role;
  // Nobody may add a person with more access than they have themselves —
  // otherwise "Add employee" is a way to mint an Owner.
  if (privilegeRank(role.key) > privilegeRank(session.membership.roleKey)) {
    return {
      ok: false,
      error: `You can't add someone with more access than your own. ${designation.name} has ${role.name} access.`,
    };
  }

  if (data.photoPath && (!mediaPathOk(data.photoPath, tenantId, "photos") || !(await mediaExists(data.photoPath)))) {
    return { ok: false, error: "The photo didn't upload properly. Take or choose it again." };
  }

  for (const [label, id, count] of [
    ["department", data.departmentId, () => db.department.count({ where: { id: data.departmentId!, tenantId } })],
    ["manager", data.reportingToId, () => db.tenantMembership.count({ where: { id: data.reportingToId!, tenantId } })],
    ["location", data.branchId, () => db.branch.count({ where: { id: data.branchId!, tenantId } })],
    ["shift", data.shiftId, () => db.shift.count({ where: { id: data.shiftId!, tenantId } })],
  ] as const) {
    if (id && (await count()) === 0) {
      return { ok: false, error: `That ${label} is no longer available.` };
    }
  }

  // ---- duplicates -------------------------------------------------------
  // Checked in this tenant first (where we may name the colleague), then
  // platform-wide (where we may not say who, or even that they exist).
  if (employeeCode) {
    const clash = await db.tenantMembership.findFirst({
      where: { tenantId, employeeCode },
      include: { user: true },
    });
    if (clash) {
      return {
        ok: false,
        error: describeClash({
          inThisTenant: true,
          heldElsewhere: false,
          field: "employeeCode",
          holderName: clash.user.displayName,
        })!,
      };
    }
  }

  for (const [field, value] of [
    ["email", email],
    ["mobile", mobile.value],
  ] as const) {
    if (!value) continue;
    const holder = await db.user.findFirst({
      where: field === "email" ? { email: value } : { phone: value },
      include: { memberships: { where: { tenantId }, include: { user: true } } },
    });
    if (!holder) continue;

    const here = holder.memberships[0];
    const message = describeClash({
      inThisTenant: Boolean(here),
      heldElsewhere: true,
      field,
      holderName: here ? holder.displayName : undefined,
    });
    if (message) return { ok: false, error: message };
  }

  // ---- the auth account -------------------------------------------------
  // Created up front so the person exists to be signed in later. Without an
  // email there is nothing for Supabase to key on, so the employee record
  // is created anyway and the screen says plainly that they cannot sign in
  // yet — an SME hires people who have no email address, and their
  // attendance still has to be recorded.
  let authUserId: string | null = null;
  if (email) {
    const admin = getSupabaseAdmin();
    if (!admin) return { ok: false, error: ADMIN_KEY_MISSING };

    const created = await admin.auth.admin.createUser({
      email,
      // Confirmed because WE verified them: an admin at their employer
      // entered the address. The invitation token is the proof of control.
      email_confirm: true,
      // Unguessable and never shown. Replaced when they accept.
      password: randomBytes(24).toString("base64url"),
      user_metadata: { invited_by: session.user.displayName, tenant: session.tenant.name },
    });

    if (created.error) {
      const detail = created.error.message ?? "";
      if (/already|registered|exists/i.test(detail)) {
        return {
          ok: false,
          error: "This email address can't be used here. Use a different one for this person.",
        };
      }
      return { ok: false, error: `The sign-in account couldn't be created: ${detail}` };
    }
    authUserId = created.data.user?.id ?? null;
  }

  // ---- the records ------------------------------------------------------
  const membership = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        authUserId,
        email,
        phone: mobile.value,
        displayName: data.displayName,
        status: "INVITED",
      },
    });
    return tx.tenantMembership.create({
      data: {
        tenantId,
        userId: user.id,
        roleId: role.id,
        status: "INVITED",
        employeeCode,
        departmentId: data.departmentId ?? null,
        designation: designation.name,
        designationId: designation.id,
        photoPath: data.photoPath ?? null,
        bloodGroup: data.bloodGroup ?? null,
        reportingToId: data.reportingToId ?? null,
        joinedOn: data.joinedOn ? new Date(`${data.joinedOn}T00:00:00.000Z`) : null,
        employmentType: data.employmentType,
        branchId: data.branchId ?? null,
        shiftId: data.shiftId ?? null,
      },
      include: { user: true },
    });
  });

  await recordAuditEvent(session, {
    action: "employee.invited",
    entityType: "membership",
    entityId: membership.id,
    after: {
      name: data.displayName,
      role: role.name,
      designation: designation.name,
      employeeCode,
      hasEmail: Boolean(email),
      employmentType: data.employmentType,
    },
    metadata: { channel: email ? "EMAIL" : "LINK", authAccount: Boolean(authUserId) },
  });

  revalidatePath("/admin/employees");

  if (!email) {
    return {
      ok: true,
      message: `${data.displayName} is on your team.`,
      detail:
        "No email address, so no invitation was sent. Add an email on their profile when you have one, and they'll be able to sign in.",
    };
  }

  const delivery = await issueInvite({
    session,
    membershipId: membership.id,
    employeeName: membership.user.displayName,
    email,
    isResend: false,
  });

  return delivery.sent
    ? {
        ok: true,
        message: `${data.displayName} is on your team.`,
        detail: `An invitation is on its way to ${email}. They'll set their own password.`,
        inviteLink: delivery.link ?? undefined,
      }
    : {
        ok: true,
        message: `${data.displayName} is on your team.`,
        detail: delivery.reason,
        inviteLink: delivery.link ?? undefined,
      };
}

// ------------------------------------------------------- issue / resend

interface IssueInput {
  session: Awaited<ReturnType<typeof checkAccess>>["session"];
  membershipId: string;
  employeeName: string;
  email: string;
  isResend: boolean;
}

/**
 * Send an invitation from the signed-in admin (deliver.ts does the work).
 * A self-serve company's invitations are held until its owner confirms
 * their email; they go out by themselves when that happens (held.ts).
 */
async function issueInvite(input: IssueInput): Promise<InviteDelivery> {
  // Read fresh, not from the session: the owner may have confirmed a
  // moment ago in another tab.
  const tenant = await getDb().tenant.findUnique({
    where: { id: input.session.tenant.id },
    select: { selfSignup: true, ownerEmailVerifiedAt: true },
  });
  if (tenant && invitationsHeld(tenant)) {
    return { sent: false, link: null, reason: INVITE_HELD_REASON };
  }
  return deliverInvite(
    {
      tenantId: input.session.tenant.id,
      companyName: input.session.tenant.name,
      timeZone: input.session.tenant.timezone,
      invitedByUserId: input.session.user.id,
      invitedByName: input.session.user.displayName,
    },
    {
      membershipId: input.membershipId,
      employeeName: input.employeeName,
      email: input.email,
      isResend: input.isResend,
    },
  );
}

export async function resendInviteAction(input: {
  membershipId: string;
}): Promise<ActionResult> {
  const { session, decision } = await checkAccess({
    module: "EMPLOYEES",
    permission: "employees.manage",
  });
  if (!decision.allowed) {
    return { ok: false, error: decision.message ?? "You don't have access to this." };
  }

  const db = getDb();
  const membership = await db.tenantMembership.findFirst({
    where: { id: input.membershipId, tenantId: session.tenant.id },
    include: {
      user: true,
      invites: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!membership) return { ok: false, error: "That employee is no longer available." };
  if (!membership.user.email) {
    return {
      ok: false,
      error: "No email address on file. Add one on their profile first.",
    };
  }

  const latest = membership.invites[0];
  if (latest) {
    const gate = canResendInvite(
      {
        status: latest.status,
        resendCount: latest.resendCount,
        lastResendAt: latest.lastResendAt,
      },
      new Date(),
    );
    if (!gate.allowed) return { ok: false, error: gate.reason };
  }

  const delivery = await issueInvite({
    session,
    membershipId: membership.id,
    employeeName: membership.user.displayName,
    email: membership.user.email,
    isResend: true,
  });

  await recordAuditEvent(session, {
    action: "employee.invite_resent",
    entityType: "membership",
    entityId: membership.id,
    metadata: {
      to: membership.user.email,
      attempt: (latest?.resendCount ?? 0) + 1,
      delivered: delivery.sent,
    },
  });

  revalidatePath("/admin/employees");
  revalidatePath(`/admin/employees/${membership.id}`);

  return delivery.sent
    ? {
        ok: true,
        message: "Invitation sent again.",
        detail: `To ${membership.user.email}. The previous link no longer works.`,
        inviteLink: delivery.link ?? undefined,
      }
    : {
        ok: false,
        error: delivery.reason ?? "The email didn't go through.",
        inviteLink: delivery.link ?? undefined,
      };
}

// -------------------------------------------------------------- revoke

export async function revokeInviteAction(input: {
  membershipId: string;
}): Promise<ActionResult> {
  const { session, decision } = await checkAccess({
    module: "EMPLOYEES",
    permission: "employees.manage",
  });
  if (!decision.allowed) {
    return { ok: false, error: decision.message ?? "You don't have access to this." };
  }

  const db = getDb();
  const membership = await db.tenantMembership.findFirst({
    where: { id: input.membershipId, tenantId: session.tenant.id },
    include: { user: true },
  });
  if (!membership) return { ok: false, error: "That employee is no longer available." };

  const { count } = await db.employeeInvite.updateMany({
    where: {
      membershipId: membership.id,
      tenantId: session.tenant.id,
      status: "PENDING",
    },
    data: { status: "REVOKED", revokedAt: new Date() },
  });

  if (count === 0) {
    return { ok: false, error: "There's no invitation waiting for them." };
  }

  await recordAuditEvent(session, {
    action: "employee.invite_revoked",
    entityType: "membership",
    entityId: membership.id,
    metadata: { invitesRevoked: count },
  });

  revalidatePath("/admin/employees");
  revalidatePath(`/admin/employees/${membership.id}`);

  return {
    ok: true,
    message: "Invitation withdrawn.",
    detail: `The link sent to ${membership.user.displayName} no longer works.`,
  };
}

// ---------------------------------------------------------- deactivate

const deactivateSchema = z.object({
  membershipId: z.string().uuid(),
  reason: z.string().trim().min(1, "Say why — the record keeps it.").max(500),
});

/**
 * Deactivation, not deletion. Their attendance, leave and payslips are
 * evidence and stay exactly as recorded (Product Constitution §3).
 */
export async function deactivateEmployeeAction(
  input: z.input<typeof deactivateSchema>,
): Promise<ActionResult> {
  const parsed = deactivateSchema.safeParse(input);
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
    include: { user: true, headOfDepartments: true },
  });
  if (!membership) return { ok: false, error: "That employee is no longer available." };
  if (membership.userId === session.user.id) {
    return { ok: false, error: "You can't deactivate your own account." };
  }
  if (membership.status === "DEACTIVATED") {
    return { ok: false, error: `${membership.user.displayName} is already deactivated.` };
  }

  // The last person who can run the company must not be able to lock
  // everyone out (edge-cases.md → "last owner").
  if (session.membership.roleKey !== "EMPLOYEE") {
    const remainingOwners = await db.tenantMembership.count({
      where: {
        tenantId: session.tenant.id,
        status: "ACTIVE",
        role: { key: "OWNER" },
        id: { not: membership.id },
      },
    });
    const isOwner = await db.tenantMembership.findFirst({
      where: { id: membership.id, role: { key: "OWNER" } },
      select: { id: true },
    });
    if (isOwner && remainingOwners === 0) {
      return {
        ok: false,
        error:
          "This is the only owner. Make someone else an owner first, or the company would be left with nobody who can manage it.",
      };
    }
  }

  const headOf = membership.headOfDepartments.filter((d) => d.isActive);

  await db.$transaction(async (tx) => {
    await tx.tenantMembership.update({
      where: { id: membership.id },
      data: { status: "DEACTIVATED" },
    });
    await tx.employeeInvite.updateMany({
      where: { membershipId: membership.id, status: "PENDING" },
      data: { status: "REVOKED", revokedAt: new Date() },
    });
    // Any decision waiting on them personally is released, so it does not
    // sit in a queue nobody can see.
    await tx.actionRequestRecipient.deleteMany({
      where: { tenantId: session.tenant.id, userId: membership.userId },
    });
    // Departments they headed lose their head rather than pointing at a
    // deactivated person; the department screen then says so.
    if (headOf.length > 0) {
      await tx.department.updateMany({
        where: { id: { in: headOf.map((d) => d.id) } },
        data: { headId: null },
      });
    }
  });

  // Sign-in is blocked by the membership check, but the auth session is
  // also revoked so an open phone stops working now rather than at expiry.
  if (membership.user.authUserId) {
    const admin = getSupabaseAdmin();
    await admin?.auth.admin.signOut(membership.user.authUserId, "global").catch(() => {
      // Best effort: the membership check already denies access.
    });
  }

  await recordAuditEvent(session, {
    action: "employee.deactivated",
    entityType: "membership",
    entityId: membership.id,
    reason: parsed.data.reason,
    before: { status: membership.status },
    after: { status: "DEACTIVATED" },
    metadata: { departmentsLeftWithoutHead: headOf.map((d) => d.name) },
  });

  revalidatePath("/admin/employees");
  revalidatePath(`/admin/employees/${membership.id}`);

  return {
    ok: true,
    message: `${membership.user.displayName} is deactivated.`,
    detail:
      headOf.length > 0
        ? `Their attendance and payslips are kept. ${headOf.map((d) => d.name).join(" and ")} now has no head — approvals there go to admins until you name one.`
        : "They can't sign in. Their attendance, leave and payslips are kept exactly as recorded.",
  };
}
