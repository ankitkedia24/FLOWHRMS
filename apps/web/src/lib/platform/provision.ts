import "server-only";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import {
  DEFAULT_ENABLED_MODULES,
  FEATURES,
  MODULES,
  PERMISSIONS,
  ROLE_TEMPLATES,
  type ModuleKey,
} from "@/lib/catalog";
import {
  generateInviteToken,
  hashInviteToken,
  inviteExpiryFrom,
  inviteUrl,
} from "@/lib/invites/token";
import { normaliseEmail } from "@/lib/invites/policy";
import { slugify } from "./slug";

/**
 * Create a customer company and its owner.
 *
 * This used to live only in scripts/create-tenant.ts. Onboarding a paying
 * customer is not a thing that should exist in one place and be reinvented
 * in another — a UI copy would drift from the script the way the admin
 * tables drifted from `ui/Table`, and the first symptom would be a customer
 * whose roles or module entitlements are subtly wrong. Both callers now run
 * these exact lines.
 *
 * Nobody's password is set here and no Supabase secret is needed: the
 * invitation link is the only credential produced, it works once, and the
 * auth account is created when the owner redeems it. So this cannot leak a
 * password, and the owner is onboarded through the same flow their staff
 * will use.
 */

export type ProvisionActor =
  | { type: "SYSTEM"; via: string }
  | { type: "USER"; userId: string; via: string };

export interface ProvisionInput {
  name: string;
  ownerEmail: string;
  ownerName: string;
  slug?: string;
  timezone?: string;
  /** Origin the invitation link should point at. */
  origin: string;
  actor: ProvisionActor;
  /** Self-serve trial: plan, end date and what the registrant told us. */
  trial?: {
    endsAt: Date;
    profile: {
      industry: string;
      staffCount: number;
      addressPincode: string;
      addressCity: string;
      addressState: string;
      addressCountry: string;
      signupRole: string;
      signupHeardFrom: string | null;
    };
    ownerPhone: string;
  };
  /** Modules switched on; the rest are off and not allowed (trial package). Default: the catalog default, all allowed. */
  enabledModules?: ModuleKey[];
  /**
   * Runs inside the creating transaction, after everything else — so
   * records that must exist together with the company (consent) do, or
   * the whole company is rolled back.
   */
  onCreated?: (
    tx: Prisma.TransactionClient,
    created: { tenantId: string; userId: string; membershipId: string },
  ) => Promise<void>;
}

export type ProvisionResult =
  | {
      ok: true;
      tenantId: string;
      slug: string;
      inviteLink: string;
      /** The raw one-time token, for callers that hand it straight to the owner. */
      inviteToken: string;
      ownerUserId: string;
      /** Companies this owner already belonged to. Legitimate, but said out loud. */
      alsoOwns: string[];
    }
  | { ok: false; error: string };

export async function provisionTenant(
  db: PrismaClient,
  input: ProvisionInput,
): Promise<ProvisionResult> {
  const name = input.name.trim();
  const ownerName = input.ownerName.trim();
  const ownerEmail = normaliseEmail(input.ownerEmail);
  const timezone = input.timezone?.trim() || "Asia/Kolkata";
  const slug = (input.slug?.trim() || slugify(name)).trim();

  if (!name) return { ok: false, error: "Give the company a name." };
  if (!ownerName) return { ok: false, error: "Give the owner's name." };
  if (!slug) {
    return {
      ok: false,
      error: "That company name has no letters or numbers to build an address from. Set the short name yourself.",
    };
  }

  // Refuse to clobber rather than merge into an existing company.
  const existingTenant = await db.tenant.findUnique({ where: { slug } });
  if (existingTenant) {
    return {
      ok: false,
      error: `"${existingTenant.name}" already uses the short name "${slug}". Choose a different one.`,
    };
  }

  const existingUser = await db.user.findUnique({
    where: { email: ownerEmail },
    include: { memberships: { include: { tenant: true } } },
  });
  // One login across several companies is legitimate — an accountant, a
  // group owner. Doing it silently is not.
  const alsoOwns =
    existingUser?.memberships.map((m) => m.tenant.name).filter(Boolean) ?? [];

  // The platform catalog must already be seeded. Read it in three queries
  // rather than one per row: this runs while a new customer watches a
  // "Setting up your company" screen.
  const [permissionRows, moduleRows, featureRows] = await Promise.all([
    db.permission.findMany({
      where: { key: { in: PERMISSIONS.map((p) => p.key) } },
      select: { id: true, key: true },
    }),
    db.module.findMany({
      where: { key: { in: Object.keys(MODULES) } },
      select: { id: true, key: true },
    }),
    db.feature.findMany({ select: { id: true, key: true, module: { select: { key: true } } } }),
  ]);
  const permissionIdByKey = new Map(permissionRows.map((r) => [r.key, r.id]));
  const missingPermission = PERMISSIONS.find((p) => !permissionIdByKey.has(p.key));
  if (missingPermission) {
    return {
      ok: false,
      error: `The permission catalog is incomplete ("${missingPermission.key}" is missing). Run the database seed before creating companies.`,
    };
  }
  const moduleIdByKey = new Map(moduleRows.map((r) => [r.key, r.id]));
  const missingModule = Object.keys(MODULES).find((k) => !moduleIdByKey.has(k));
  if (missingModule) {
    return {
      ok: false,
      error: `The module catalog is incomplete ("${missingModule}" is missing). Run the database seed before creating companies.`,
    };
  }
  const featureIdByKey = new Map(featureRows.map((r) => [`${r.module.key}:${r.key}`, r.id]));

  const result = await db.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        slug,
        name,
        timezone,
        status: "ACTIVE",
        ...(input.trial
          ? {
              plan: "TRIAL" as const,
              trialEndsAt: input.trial.endsAt,
              selfSignup: true,
              ...input.trial.profile,
            }
          : {}),
      },
    });

    let ownerRoleId: string | null = null;
    const roles = await tx.role.createManyAndReturn({
      data: ROLE_TEMPLATES.map((tpl) => ({
        tenantId: tenant.id,
        key: tpl.key,
        name: tpl.name,
        description: tpl.description,
        isSystem: true,
      })),
      select: { id: true, key: true },
    });
    const roleIdByKey = new Map(roles.map((r) => [r.key, r.id]));
    ownerRoleId = roleIdByKey.get("OWNER") ?? null;
    await tx.rolePermission.createMany({
      data: ROLE_TEMPLATES.flatMap((tpl) =>
        tpl.permissions.map((k) => ({
          roleId: roleIdByKey.get(tpl.key)!,
          permissionId: permissionIdByKey.get(k)!,
        })),
      ),
    });
    if (!ownerRoleId) throw new Error("No OWNER role template in the catalog.");

    // A starting list of designations, one per access level, so the first
    // "Add employee" has something to pick. The owner's own title (from
    // sign-up, e.g. "Partner / Director") is added with Owner access.
    const ownerTitle = input.trial?.profile.signupRole?.trim() || null;
    const designations = await tx.designation.createManyAndReturn({
      data: [
        ...ROLE_TEMPLATES.map((tpl) => ({ tenantId: tenant.id, name: tpl.name, roleId: roleIdByKey.get(tpl.key)! })),
        ...(ownerTitle && !ROLE_TEMPLATES.some((t) => t.name === ownerTitle)
          ? [{ tenantId: tenant.id, name: ownerTitle, roleId: ownerRoleId }]
          : []),
      ],
      select: { id: true, name: true },
    });
    const ownerDesignation =
      designations.find((d) => d.name === (ownerTitle ?? "Owner")) ?? designations.find((d) => d.name === "Owner")!;

    // A trial package decides both what is on and what the company may
    // turn on itself; otherwise the catalog default applies and everything
    // is theirs to switch.
    const enabledKeys = (input.enabledModules ?? DEFAULT_ENABLED_MODULES) as string[];
    await tx.tenantModuleSetting.createMany({
      data: Object.values(MODULES).map((m) => ({
        tenantId: tenant.id,
        moduleId: moduleIdByKey.get(m.key)!,
        enabled: enabledKeys.includes(m.key),
        allowedByPlatform: input.enabledModules
          ? enabledKeys.includes(m.key)
          : true,
      })),
    });

    await tx.tenantFeatureSetting.createMany({
      data: FEATURES.flatMap((f) => {
        const featureId = featureIdByKey.get(`${f.module}:${f.key}`);
        return featureId
          ? [{ tenantId: tenant.id, featureId, enabled: f.defaultEnabled }]
          : [];
      }),
    });

    // INVITED until they set their own password.
    const user = existingUser
      ? await tx.user.update({
          where: { id: existingUser.id },
          data: { displayName: existingUser.displayName || ownerName },
        })
      : await tx.user.create({
          data: {
            email: ownerEmail,
            displayName: ownerName,
            status: "INVITED",
            phone: input.trial?.ownerPhone ?? null,
          },
        });

    const membership = await tx.tenantMembership.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        roleId: ownerRoleId,
        status: "INVITED",
        employmentType: "FULL_TIME",
        designation: ownerDesignation.name,
        designationId: ownerDesignation.id,
      },
    });

    const token = generateInviteToken();
    const now = new Date();
    await tx.employeeInvite.create({
      data: {
        tenantId: tenant.id,
        membershipId: membership.id,
        tokenHash: hashInviteToken(token),
        channel: "EMAIL",
        status: "PENDING",
        sentToEmail: ownerEmail,
        expiresAt: inviteExpiryFrom(now),
        sentAt: now,
      },
    });

    await tx.auditEvent.create({
      data: {
        tenantId: tenant.id,
        actorType: input.actor.type,
        actorUserId: input.actor.type === "USER" ? input.actor.userId : null,
        action: input.trial ? "tenant.self_signup" : "tenant.created",
        entityType: "tenant",
        entityId: tenant.id,
        metadata: {
          name,
          slug,
          timezone,
          owner: ownerEmail,
          via: input.actor.via,
          ...(input.trial
            ? { plan: "TRIAL", trialEndsAt: input.trial.endsAt.toISOString() }
            : {}),
        },
      },
    });

    if (input.onCreated) {
      await input.onCreated(tx, {
        tenantId: tenant.id,
        userId: user.id,
        membershipId: membership.id,
      });
    }

    return { tenant, token, userId: user.id };
  },
  // Roles, permissions, modules and features are ~60 writes. Prisma's 5 s
  // default was being exceeded on an ordinary day (5.1 s measured, 27 Sept
  // 2026), and a timeout rolls the whole company back — "Add a company"
  // then fails for no reason the operator can see. Same allowance style as
  // purge.ts.
  { timeout: 30_000, maxWait: 10_000 },
  );

  return {
    ok: true,
    tenantId: result.tenant.id,
    slug,
    inviteLink: inviteUrl(input.origin, result.token),
    inviteToken: result.token,
    ownerUserId: result.userId,
    alsoOwns,
  };
}
