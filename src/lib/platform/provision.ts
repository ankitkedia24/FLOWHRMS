import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import {
  DEFAULT_ENABLED_MODULES,
  FEATURES,
  MODULES,
  PERMISSIONS,
  ROLE_TEMPLATES,
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
}

export type ProvisionResult =
  | {
      ok: true;
      tenantId: string;
      slug: string;
      inviteLink: string;
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

  // The platform catalog must already be seeded.
  const permissionIdByKey = new Map<string, string>();
  for (const p of PERMISSIONS) {
    const row = await db.permission.findUnique({ where: { key: p.key } });
    if (!row) {
      return {
        ok: false,
        error: `The permission catalog is incomplete ("${p.key}" is missing). Run the database seed before creating companies.`,
      };
    }
    permissionIdByKey.set(p.key, row.id);
  }
  const moduleIdByKey = new Map<string, string>();
  for (const key of Object.keys(MODULES)) {
    const row = await db.module.findUnique({ where: { key } });
    if (!row) {
      return {
        ok: false,
        error: `The module catalog is incomplete ("${key}" is missing). Run the database seed before creating companies.`,
      };
    }
    moduleIdByKey.set(key, row.id);
  }

  const result = await db.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: { slug, name, timezone, status: "ACTIVE" },
    });

    let ownerRoleId: string | null = null;
    for (const tpl of ROLE_TEMPLATES) {
      const role = await tx.role.create({
        data: {
          tenantId: tenant.id,
          key: tpl.key,
          name: tpl.name,
          description: tpl.description,
          isSystem: true,
        },
      });
      if (tpl.key === "OWNER") ownerRoleId = role.id;
      if (tpl.permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: tpl.permissions.map((k) => ({
            roleId: role.id,
            permissionId: permissionIdByKey.get(k)!,
          })),
        });
      }
    }
    if (!ownerRoleId) throw new Error("No OWNER role template in the catalog.");

    await tx.tenantModuleSetting.createMany({
      data: Object.values(MODULES).map((m) => ({
        tenantId: tenant.id,
        moduleId: moduleIdByKey.get(m.key)!,
        enabled: (DEFAULT_ENABLED_MODULES as string[]).includes(m.key),
      })),
    });

    for (const f of FEATURES) {
      const feature = await tx.feature.findFirst({
        where: { key: f.key, module: { key: f.module } },
      });
      if (!feature) continue;
      await tx.tenantFeatureSetting.create({
        data: {
          tenantId: tenant.id,
          featureId: feature.id,
          enabled: f.defaultEnabled,
        },
      });
    }

    // INVITED until they set their own password.
    const user = existingUser
      ? await tx.user.update({
          where: { id: existingUser.id },
          data: { displayName: existingUser.displayName || ownerName },
        })
      : await tx.user.create({
          data: { email: ownerEmail, displayName: ownerName, status: "INVITED" },
        });

    const membership = await tx.tenantMembership.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        roleId: ownerRoleId,
        status: "INVITED",
        employmentType: "FULL_TIME",
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
        action: "tenant.created",
        entityType: "tenant",
        entityId: tenant.id,
        metadata: {
          name,
          slug,
          timezone,
          owner: ownerEmail,
          via: input.actor.via,
        },
      },
    });

    return { tenant, token };
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
    alsoOwns,
  };
}
