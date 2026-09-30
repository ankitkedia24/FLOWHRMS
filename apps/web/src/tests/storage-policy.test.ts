import { describe, expect, it } from "vitest";
import { documentPath, proofPath, receiptPath } from "@/lib/storage/paths";
import { mediaPathOk } from "@/lib/media/bucket";
import {
  BUCKETS,
  MEMBER_FUNCTIONS_SQL,
  UPLOAD_RULES,
  applyPolicySql,
  policyName,
  previousUploadRule,
  rollbackPolicySql,
} from "../../scripts/storage-policy";

/**
 * The shape of the storage upload rules (scripts/storage-policy.ts). What
 * they actually allow and refuse is proven against the database in
 * storage-policy-integration.test.ts; this keeps the SQL honest without one.
 */
const TENANT = "11111111-1111-4111-8111-111111111111";
const PERSON = "33333333-3333-4333-8333-333333333333";
const TASK = "55555555-5555-4555-8555-555555555555";
const DRAFT = "77777777-7777-4777-8777-777777777777";

const createPolicies = (sql: string[]) => sql.filter((s) => s.startsWith("create policy"));

describe("storage upload rules", () => {
  it("check the company folder, and for personal files the person's folder too", () => {
    expect(UPLOAD_RULES["task-proof"]).toContain("private.is_active_member((storage.foldername(name))[1])");
    expect(UPLOAD_RULES["company-media"]).toContain("private.is_active_member((storage.foldername(name))[1])");
    for (const bucket of ["employee-documents", "expense-receipts"] as const) {
      expect(UPLOAD_RULES[bucket]).toContain(
        "private.is_own_membership((storage.foldername(name))[1], (storage.foldername(name))[2])",
      );
    }
    for (const bucket of BUCKETS) expect(UPLOAD_RULES[bucket]).toMatch(new RegExp(`^bucket_id = '${bucket}' and `));
  });

  it("match where the uploaders put files: company first, then the person where it is personal", () => {
    expect(documentPath(TENANT, PERSON, "id.pdf").split("/").slice(0, 2)).toEqual([TENANT, PERSON]);
    expect(receiptPath(TENANT, PERSON, DRAFT, "bill.jpg").split("/").slice(0, 2)).toEqual([TENANT, PERSON]);
    expect(proofPath(TENANT, TASK, "site.jpg").split("/")[0]).toBe(TENANT);
    expect(mediaPathOk(`${TENANT}/logo/1-abc.png`, TENANT, "logo")).toBe(true);
  });

  it("apply: functions first, then exactly one INSERT policy per bucket and nothing to read, change or delete", () => {
    const sql = applyPolicySql();
    const firstPolicy = sql.findIndex((s) => s.startsWith("create policy"));
    const lastFunctionGrant = sql.findLastIndex((s) => s.startsWith("grant execute"));
    expect(lastFunctionGrant).toBeLessThan(firstPolicy);

    const created = createPolicies(sql);
    expect(created).toHaveLength(BUCKETS.length);
    for (const bucket of BUCKETS) {
      const statement = created.find((s) => s.includes(`"${policyName(bucket, "insert")}"`));
      expect(statement).toContain("for insert to authenticated");
      expect(statement).toContain(`with check (${UPLOAD_RULES[bucket]})`);
      for (const cmd of ["select", "update", "delete"] as const) {
        expect(sql).toContain(`drop policy if exists "${policyName(bucket, cmd)}" on storage.objects`);
      }
    }
  });

  it("functions: security definer, empty search_path, no input cast before it is checked, authenticated only", () => {
    const functions = MEMBER_FUNCTIONS_SQL.filter((s) => s.startsWith("create or replace function"));
    expect(functions).toHaveLength(2);
    for (const fn of functions) {
      expect(fn).toContain("security definer");
      expect(fn).toContain("set search_path = ''");
      expect(fn).toMatch(/\bstable\b/);
      expect(fn).toContain("auth.uid()");
      // The guard comes before any cast, so bad input is "no", not an error.
      expect(fn.indexOf("!~")).toBeLessThan(fn.indexOf("::uuid"));
    }
    const grants = MEMBER_FUNCTIONS_SQL.filter((s) => s.startsWith("grant"));
    expect(grants.every((s) => s.endsWith("to authenticated"))).toBe(true);
    expect(MEMBER_FUNCTIONS_SQL.filter((s) => s.startsWith("revoke all on function"))).toHaveLength(2);
    expect(MEMBER_FUNCTIONS_SQL).toContain("revoke all on schema private from public");
  });

  it("rollback: the old bucket-only rule for every bucket, before the functions it no longer needs are dropped", () => {
    const sql = rollbackPolicySql();
    const created = createPolicies(sql);
    expect(created).toHaveLength(BUCKETS.length);
    for (const bucket of BUCKETS) {
      expect(created.some((s) => s.endsWith(`with check (${previousUploadRule(bucket)})`))).toBe(true);
    }
    const lastPolicy = sql.findLastIndex((s) => s.startsWith("create policy"));
    const firstDrop = sql.findIndex((s) => s.startsWith("drop function"));
    expect(lastPolicy).toBeLessThan(firstDrop);
  });
});
