import { describe, expect, it } from "vitest";
import { evaluateAccess } from "@/lib/authz/flags";
import type { AppSession, TenantEntitlements } from "@/lib/auth/types";
import { ROLE_TEMPLATES } from "@/lib/catalog";

/**
 * The dashboard's "Recent activity" card makes the same decision as the
 * activity log (/admin/activity): EMPLOYEES + audit.view. admin.access
 * alone — which every dashboard visitor has — is not enough.
 */
function sessionFor(roleKey: string): AppSession {
  const template = ROLE_TEMPLATES.find((r) => r.key === roleKey)!;
  return {
    user: { id: "u1", displayName: "Test User", email: "t@example.com", isPlatformAdmin: false },
    tenant: {
      id: "t1",
      slug: "demo",
      name: "Demo",
      timezone: "Asia/Kolkata",
      plan: "INTERNAL",
      trialEndsAt: null,
      selfSignup: false,
      ownerEmailVerifiedAt: null,
      paidUntil: null,
    },
    membership: { id: "m1", roleKey, roleName: template.name, employeeCode: null },
    permissions: new Set(template.permissions),
    source: "dev-fixture",
  };
}

const entitlements: TenantEntitlements = {
  modules: { EMPLOYEES: true },
  features: {},
  userExceptions: {},
};

const seesActivity = (roleKey: string) =>
  evaluateAccess({
    session: sessionFor(roleKey),
    entitlements,
    module: "EMPLOYEES",
    permission: "audit.view",
  }).allowed;

describe("recent activity on the admin dashboard", () => {
  it("is hidden from admins who can't open the activity log", () => {
    for (const role of ["ADMIN", "HR", "MANAGER"]) {
      expect(sessionFor(role).permissions.has("admin.access")).toBe(true);
      expect(seesActivity(role)).toBe(false);
    }
  });

  it("is shown to those who can", () => {
    expect(seesActivity("OWNER")).toBe(true);
    expect(seesActivity("SUPER_ADMIN")).toBe(true);
  });
});
