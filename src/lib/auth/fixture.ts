import "server-only";

import {
  DEFAULT_ENABLED_MODULES,
  FEATURES,
  MODULES,
  ROLE_TEMPLATES,
  type PermissionKey,
} from "@/lib/catalog";
import { getDb, hasDatabaseConfig } from "@/lib/db";
import type { AppSession, TenantEntitlements } from "./types";

/**
 * Dev preview session ("fixture mode").
 *
 * Lets the application shell render without a Supabase sign-in — local
 * preview and UI review only. Guarded twice: the env flag AND
 * NODE_ENV=development. See SECURITY-NOTES.md. Never enable outside a
 * developer machine.
 *
 * When a database IS configured it resolves the real demo tenant and a
 * real membership, so preview shows true data; otherwise it falls back to
 * static placeholders.
 */
export function devFixtureRole(): string | null {
  if (process.env.NODE_ENV !== "development") return null;
  const value = process.env.FLOWHRMS_DEV_FAKE_SESSION?.trim().toUpperCase();
  if (!value) return null;
  const allowed = ROLE_TEMPLATES.map((r) => r.key);
  return allowed.includes(value) ? value : "EMPLOYEE";
}

/** True when fixture mode must serve placeholder data (no database). */
export function devFixtureOffline(): boolean {
  return devFixtureRole() !== null && !hasDatabaseConfig();
}

const FIXTURE_TENANT = {
  id: "00000000-0000-4000-8000-00000000dead",
  slug: "demo-co",
  name: "Demo Trading Co. (placeholder)",
  timezone: "Asia/Kolkata",
} as const;

/** Resolve a preview session, preferring real database records. */
export async function fixtureSession(
  roleKey: string,
): Promise<AppSession> {
  const template =
    ROLE_TEMPLATES.find((r) => r.key === roleKey) ??
    ROLE_TEMPLATES.find((r) => r.key === "EMPLOYEE")!;

  if (hasDatabaseConfig()) {
    try {
      const db = getDb();
      // Prefer the seeded demo tenant, but fall back to any active one.
      // The demo tenant is deleted from a production database before a real
      // customer arrives (scripts/delete-tenant.ts), and without this the
      // preview session silently degrades to placeholders whose tenant id
      // matches no row — so every screen renders empty and looks broken.
      const membership =
        (await db.tenantMembership.findFirst({
          where: {
            status: "ACTIVE",
            role: { key: template.key },
            tenant: { slug: FIXTURE_TENANT.slug, status: "ACTIVE" },
          },
          orderBy: { createdAt: "asc" },
          include: {
            user: true,
            tenant: true,
            role: { include: { permissions: { include: { permission: true } } } },
          },
        })) ??
        (await db.tenantMembership.findFirst({
          where: {
            status: "ACTIVE",
            role: { key: template.key },
            tenant: { status: "ACTIVE" },
          },
          orderBy: { createdAt: "asc" },
          include: {
            user: true,
            tenant: true,
            role: { include: { permissions: { include: { permission: true } } } },
          },
        }));

      if (membership) {
        return {
          user: {
            id: membership.user.id,
            displayName: membership.user.displayName,
            email: membership.user.email,
            isPlatformAdmin: membership.user.isPlatformAdmin,
          },
          tenant: {
            id: membership.tenant.id,
            slug: membership.tenant.slug,
            name: membership.tenant.name,
            timezone: membership.tenant.timezone,
            plan: membership.tenant.plan,
            trialEndsAt: membership.tenant.trialEndsAt,
            selfSignup: membership.tenant.selfSignup,
            ownerEmailVerifiedAt: membership.tenant.ownerEmailVerifiedAt,
          },
          membership: {
            id: membership.id,
            roleKey: membership.role.key,
            roleName: membership.role.name,
            employeeCode: membership.employeeCode,
          },
          permissions: new Set(
            membership.role.permissions.map(
              (rp) => rp.permission.key as PermissionKey,
            ),
          ),
          source: "dev-fixture",
        };
      }
    } catch {
      // Fall through to static placeholders if the database is unreachable.
    }
  }

  return {
    user: {
      id: "00000000-0000-4000-8000-0000000000f1",
      displayName:
        template.key === "EMPLOYEE"
          ? "Dev Employee (placeholder)"
          : `Dev ${template.name} (placeholder)`,
      email: `dev.${template.key.toLowerCase()}@example.com`,
      isPlatformAdmin: false,
    },
    tenant: {
      ...FIXTURE_TENANT,
      plan: "INTERNAL",
      trialEndsAt: null,
      selfSignup: false,
      ownerEmailVerifiedAt: null,
    },
    membership: {
      id: "00000000-0000-4000-8000-0000000000b1",
      roleKey: template.key,
      roleName: template.name,
      employeeCode: template.key === "EMPLOYEE" ? "EMP-0001" : null,
    },
    permissions: new Set(template.permissions),
    source: "dev-fixture",
  };
}

/** Entitlements mirroring the seed defaults (no-database fallback). */
export function fixtureEntitlements(): TenantEntitlements {
  const modules: TenantEntitlements["modules"] = {};
  for (const def of Object.values(MODULES)) {
    modules[def.key] =
      def.category === "CORE" ||
      DEFAULT_ENABLED_MODULES.includes(def.key as never);
  }
  const features: TenantEntitlements["features"] = {};
  for (const f of FEATURES) {
    features[`${f.module}.${f.key}`] = { enabled: f.defaultEnabled };
  }
  return { modules, features, userExceptions: {} };
}
