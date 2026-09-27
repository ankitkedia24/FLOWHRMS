import type { ModuleKey, PermissionKey } from "@/lib/catalog";

/** The resolved, tenant-aware session used by every server-side check. */
export interface AppSession {
  user: {
    id: string;
    displayName: string;
    email: string | null;
    isPlatformAdmin: boolean;
  };
  tenant: {
    id: string;
    slug: string;
    name: string;
    timezone: string;
    /** TRIAL companies pause when trialEndsAt passes; PAID ones a week after paidUntil. */
    plan: "TRIAL" | "PAID" | "INTERNAL";
    trialEndsAt: Date | null;
    selfSignup: boolean;
    ownerEmailVerifiedAt: Date | null;
    /** PAID companies: access runs to here, then 7 days' grace. */
    paidUntil: Date | null;
  };
  membership: {
    id: string;
    roleKey: string;
    roleName: string;
    employeeCode: string | null;
  };
  /** Effective permission keys from the membership's role. */
  permissions: ReadonlySet<PermissionKey>;
  /** Where this session came from — fixture sessions exist only in dev. */
  source: "supabase" | "dev-fixture";
}

/**
 * Snapshot of a tenant's module/feature entitlements used by the flag
 * evaluator. Loaded per request (from the database, or fixtures in dev).
 */
export interface TenantEntitlements {
  /** moduleKey → enabled */
  modules: Partial<Record<ModuleKey, boolean>>;
  /** "MODULE.feature_key" → setting */
  features: Record<string, { enabled: boolean; policy?: unknown }>;
  /** "MODULE.feature_key" → user-scope exception for the session user. */
  userExceptions: Record<string, boolean>;
}
