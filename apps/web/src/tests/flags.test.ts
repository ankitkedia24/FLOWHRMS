import { describe, expect, it } from "vitest";
import { enabledModuleKeys, evaluateAccess } from "@/lib/authz/flags";
import type { AppSession, TenantEntitlements } from "@/lib/auth/types";

function makeSession(
  permissions: string[] = [],
): AppSession {
  return {
    user: {
      id: "u1",
      displayName: "Test User",
      email: "t@example.com",
      isPlatformAdmin: false,
    },
    tenant: { id: "t1", slug: "demo", name: "Demo", timezone: "Asia/Kolkata", plan: "INTERNAL", trialEndsAt: null, selfSignup: false, ownerEmailVerifiedAt: null, paidUntil: null },
    membership: {
      id: "m1",
      roleKey: "ADMIN",
      roleName: "Admin",
      employeeCode: null,
    },
    permissions: new Set(permissions as never[]),
    source: "dev-fixture",
  };
}

const baseEntitlements: TenantEntitlements = {
  modules: { ATTENDANCE: true, TASKS: false },
  features: {
    "ATTENDANCE.gps_capture": { enabled: true },
    "ATTENDANCE.multiple_punch": { enabled: false },
  },
  userExceptions: {},
};

describe("evaluateAccess", () => {
  it("denies without a session", () => {
    const decision = evaluateAccess({
      session: null,
      entitlements: baseEntitlements,
      module: "ATTENDANCE",
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("no-session");
  });

  it("denies a disabled module with a plain-language message", () => {
    const decision = evaluateAccess({
      session: makeSession(),
      entitlements: baseEntitlements,
      module: "TASKS",
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("module-disabled");
    expect(decision.message).toContain("turned off for your company");
  });

  it("allows an enabled module", () => {
    const decision = evaluateAccess({
      session: makeSession(),
      entitlements: baseEntitlements,
      module: "ATTENDANCE",
    });
    expect(decision.allowed).toBe(true);
  });

  it("CORE modules are always on regardless of settings", () => {
    const decision = evaluateAccess({
      session: makeSession(),
      entitlements: { modules: {}, features: {}, userExceptions: {} },
      module: "NOTIFICATIONS",
    });
    expect(decision.allowed).toBe(true);
  });

  it("denies a disabled feature inside an enabled module", () => {
    const decision = evaluateAccess({
      session: makeSession(),
      entitlements: baseEntitlements,
      module: "ATTENDANCE",
      feature: "multiple_punch",
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("feature-disabled");
  });

  it("falls back to the catalog default when no tenant setting exists", () => {
    const decision = evaluateAccess({
      session: makeSession(),
      entitlements: {
        modules: { ATTENDANCE: true },
        features: {},
        userExceptions: {},
      },
      module: "ATTENDANCE",
      feature: "geofence", // defaultEnabled: true
    });
    expect(decision.allowed).toBe(true);
  });

  it("never counts an unbuilt switch as on — not by default, not when a company saved it on", () => {
    for (const [module, feature] of [
      ["ATTENDANCE", "gps_capture"],
      ["NOTIFICATIONS", "push"],
      ["NOTIFICATIONS", "email"],
    ] as const) {
      for (const features of [{}, { [`${module}.${feature}`]: { enabled: true } }]) {
        const decision = evaluateAccess({
          session: makeSession(),
          entitlements: { modules: { [module]: true }, features, userExceptions: {} },
          module,
          feature,
        });
        expect(decision.allowed).toBe(false);
        expect(decision.message).toBe("This isn't available yet.");
      }
    }
  });

  it("user-scope exception overrides the tenant feature setting", () => {
    const decision = evaluateAccess({
      session: makeSession(),
      entitlements: {
        ...baseEntitlements,
        userExceptions: { "ATTENDANCE.multiple_punch": true },
      },
      module: "ATTENDANCE",
      feature: "multiple_punch",
    });
    expect(decision.allowed).toBe(true);
  });

  it("denies a missing permission even when module and feature pass", () => {
    const decision = evaluateAccess({
      session: makeSession([]),
      entitlements: baseEntitlements,
      module: "ATTENDANCE",
      permission: "attendance.review",
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("missing-permission");
  });

  it("allows when the role has the permission", () => {
    const decision = evaluateAccess({
      session: makeSession(["attendance.review"]),
      entitlements: baseEntitlements,
      module: "ATTENDANCE",
      permission: "attendance.review",
    });
    expect(decision.allowed).toBe(true);
  });
});

describe("enabledModuleKeys", () => {
  it("returns only enabled modules plus CORE, sorted", () => {
    const keys = enabledModuleKeys(baseEntitlements);
    expect(keys).toContain("ATTENDANCE");
    expect(keys).toContain("NOTIFICATIONS"); // CORE
    expect(keys).not.toContain("TASKS");
    expect(keys).not.toContain("PAYROLL");
  });
});
