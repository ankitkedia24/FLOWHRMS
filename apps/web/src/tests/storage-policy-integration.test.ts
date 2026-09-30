/**
 * Who may upload where — the storage.objects INSERT policies of
 * scripts/storage-policy.ts, proven on the real database WITHOUT changing
 * it. Everything happens inside ONE transaction that is rolled back:
 *
 * 1. Temporary people are created in the placeholder company (demo-co) and
 *    the sample company (sunrise-traders-sample): members, someone in both,
 *    a suspended member, a deactivated user, someone with no membership,
 *    and a member of a temporary company that is not active.
 * 2. The previous rule ("any signed-in user may upload to the bucket") is
 *    put in place and every attempt below goes through — the hole.
 * 3. The new functions and policies are created exactly as setup-storage
 *    applies them, and every attempt is made again: own company allowed;
 *    another company, no active membership, malformed paths refused; and
 *    for documents and receipts, a colleague's folder refused.
 * 4. The rollback SQL is run and the old behaviour is back.
 * 5. ROLLBACK. Afterwards a read-only check confirms that the policies and
 *    functions are exactly as they were before, and that no test row or
 *    object exists.
 *
 * Each attempt is an INSERT into storage.objects made as the
 * `authenticated` role with the JWT claims auth.uid() reads
 * (request.jwt.claim.sub and request.jwt.claims — what the Storage API
 * sets), inside its own subtransaction so that allowed inserts are undone
 * at once and a refusal does not abort the rest. Attempts run server-side
 * in one round trip each phase: creating a policy locks storage.objects
 * until the transaction ends, so the locked window is kept to well under a
 * second, and lock_timeout makes the test give up rather than queue ahead
 * of live uploads. Skips itself without a database.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { config as loadEnv } from "dotenv";
import { Client } from "pg";
import { documentPath, proofPath, receiptPath } from "@/lib/storage/paths";
import {
  BUCKETS,
  FUNCTION_STATUS_SQL,
  POLICY_STATUS_SQL,
  UPLOAD_RULES,
  applyPolicySql,
  policyName,
  rollbackPolicySql,
  type Bucket,
} from "../../scripts/storage-policy";

loadEnv({ path: [".env.local", ".env"], quiet: true });
const CONNECTION = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
vi.setConfig({ testTimeout: 30_000, hookTimeout: 120_000 });

const MARK = "zz-storage-policy-test";
const FILE = `${MARK}.pdf`;

type Outcome = "allowed" | "refused";
type Want = Outcome | Partial<Record<Bucket, Outcome>> & { default: Outcome };

/** Who tries, and where, described once; paths are built per bucket. */
const CASES: Array<{ id: string; label: string; want: Want }> = [
  { id: "own", label: "a member, own company's folder", want: "allowed" },
  { id: "own-sample", label: "a member of the sample company, own folder", want: "allowed" },
  { id: "multi-first", label: "someone in two companies, the first", want: "allowed" },
  { id: "multi-second", label: "someone in two companies, the second", want: "allowed" },
  { id: "other", label: "a member, another company's folder", want: "refused" },
  { id: "other-reverse", label: "a sample-company member, the placeholder company's folder", want: "refused" },
  { id: "other-real-person", label: "a member, a real person's folder in another company", want: "refused" },
  { id: "suspended", label: "a suspended membership", want: "refused" },
  { id: "no-membership", label: "a user with no membership at all", want: "refused" },
  { id: "user-deactivated", label: "a deactivated user with an active membership", want: "refused" },
  { id: "no-user", label: "a signed-in account with no FlowHRMS user", want: "refused" },
  { id: "company-inactive", label: "a member of a company that is not active", want: "refused" },
  { id: "not-uuid", label: "first folder is not an id", want: "refused" },
  { id: "upper-case", label: "first folder is the company id in capitals", want: "refused" },
  { id: "no-folder", label: "no folder at all", want: "refused" },
  { id: "leading-slash", label: "a leading slash (empty first folder)", want: "refused" },
  { id: "quote", label: "a quote in the first folder", want: "refused" },
  {
    id: "colleague",
    label: "a colleague's folder in own company",
    // Proof and media are filed by task and kind, not by person.
    want: { default: "allowed", "employee-documents": "refused", "expense-receipts": "refused" },
  },
];

function wanted(want: Want, bucket: Bucket): Outcome {
  return typeof want === "string" ? want : (want[bucket] ?? want.default);
}

/** One attempt as the harness runs it. */
type Attempt = { id: string; sub: string; bucket: Bucket; name: string };

/**
 * The attempt itself, server-side: become `authenticated` with this
 * subject's claims, insert, then undo. Returns allowed / refused, or the
 * error — a permission error that is not the RLS check is NOT a refusal.
 */
const HARNESS_SQL = `create function pg_temp.zz_try_upload(p_sub text, p_bucket text, p_name text)
returns text
language plpgsql
as $fn$
declare
  seen_role text;
  seen_uid text;
begin
  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claim.sub', p_sub, true);
    perform set_config('request.jwt.claims', json_build_object('sub', p_sub, 'role', 'authenticated')::text, true);
    seen_role := current_user;
    seen_uid := auth.uid()::text;
    if seen_role <> 'authenticated' or seen_uid is distinct from p_sub then
      raise exception using errcode = 'P0002',
        message = format('harness is not impersonating (role %s)', seen_role);
    end if;
    insert into storage.objects (bucket_id, name) values (p_bucket, p_name);
    raise exception using errcode = 'P0001', message = 'zz-allowed';
  exception
    when sqlstate 'P0001' then
      return 'allowed';
    when insufficient_privilege then
      if sqlerrm like 'new row violates row-level security policy%' then
        return 'refused';
      end if;
      return 'error 42501 ' || sqlerrm;
    when others then
      return 'error ' || sqlstate || ' ' || sqlerrm;
  end;
end
$fn$`;

const SNAPSHOT_SQL = `select
  (select coalesce(json_agg(json_build_object('name', policyname, 'cmd', cmd, 'roles', roles::text, 'check', with_check) order by policyname), '[]')
     from pg_policies where schemaname = 'storage' and tablename = 'objects') as policies,
  (select coalesce(json_agg(p.oid::regprocedure::text order by p.oid::regprocedure::text), '[]')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private') as private_functions,
  to_regnamespace('private')::text as private_schema,
  (select count(*)::int from storage.objects where name like '%${MARK}%') as test_objects,
  (select count(*)::int from public.users where email like '${MARK}%') as test_users,
  (select count(*)::int from public.tenant_memberships m join public.users u on u.id = m."userId"
     where u.email like '${MARK}%') as test_memberships,
  (select count(*)::int from public.tenants where slug like '${MARK}%') as test_tenants`;

type Snapshot = {
  policies: unknown[];
  private_functions: string[];
  private_schema: string | null;
  test_objects: number;
  test_users: number;
  test_memberships: number;
  test_tenants: number;
};

async function snapshot(): Promise<Snapshot> {
  const client = new Client({ connectionString: CONNECTION });
  await client.connect();
  try {
    await client.query("begin transaction read only");
    const { rows } = await client.query(SNAPSHOT_SQL);
    await client.query("rollback");
    return rows[0] as Snapshot;
  } finally {
    await client.end();
  }
}

describe.skipIf(!CONNECTION)("storage upload policies (one rolled-back transaction)", () => {
  const stamp = Date.now();
  const tenants = { D: "", S: "", closed: crypto.randomUUID() };
  const TASK = crypto.randomUUID();
  const DRAFT = crypto.randomUUID();

  /** Temporary people: auth subject, user id, membership per company. */
  const people = {
    alice: { user: "ACTIVE", in: { D: "ACTIVE" } },
    bob: { user: "ACTIVE", in: { D: "ACTIVE" } },
    sam: { user: "ACTIVE", in: { S: "ACTIVE" } },
    multi: { user: "ACTIVE", in: { D: "ACTIVE", S: "ACTIVE" } },
    suspended: { user: "ACTIVE", in: { D: "SUSPENDED" } },
    loner: { user: "ACTIVE", in: {} },
    gone: { user: "DEACTIVATED", in: { D: "ACTIVE" } },
    closedCo: { user: "ACTIVE", in: { closed: "ACTIVE" } },
  } as const;
  type Key = keyof typeof people | "ghost";
  type Company = "D" | "S" | "closed";
  const ids = {} as Record<Key, { sub: string; userId: string; m: Partial<Record<Company, string>> }>;

  let before: Snapshot;
  let after: Snapshot;
  const results: Record<"old" | "new" | "rolledBack", Map<string, string>> = {
    old: new Map(),
    new: new Map(),
    rolledBack: new Map(),
  };
  let contract: {
    functions: Array<Record<string, unknown>>;
    grants: Record<string, boolean>;
    policies: Array<Record<string, unknown>>;
  };
  let direct: { allowed: string | null; refused: { code?: string; message?: string } | null };
  let rolledBackState: { functions: number; checks: string[] };
  let harnessLeft: string | null;
  /** How long storage.objects stayed locked by the policy changes. */
  let lockedMs = 0;

  function pathFor(bucket: Bucket, tenant: string, membership: string, n: number): string {
    const now = stamp + n;
    switch (bucket) {
      case "task-proof":
        return proofPath(tenant, TASK, FILE, now);
      case "employee-documents":
        return documentPath(tenant, membership, FILE, now);
      case "expense-receipts":
        return receiptPath(tenant, membership, DRAFT, FILE, now);
      case "company-media":
        return `${tenant}/photos/${now}-${MARK}.jpg`;
    }
  }

  /** Every case, for every bucket, as concrete attempts. */
  function attempts(): Attempt[] {
    const list: Attempt[] = [];
    let n = 0;
    for (const bucket of BUCKETS) {
      const at = (id: string, who: Key, tenant: string, membership: string) =>
        list.push({ id: `${bucket}:${id}`, sub: ids[who].sub, bucket, name: pathFor(bucket, tenant, membership, n++) });
      const own = ids.alice.m.D!;
      at("own", "alice", tenants.D, own);
      at("own-sample", "sam", tenants.S, ids.sam.m.S!);
      at("multi-first", "multi", tenants.D, ids.multi.m.D!);
      at("multi-second", "multi", tenants.S, ids.multi.m.S!);
      at("other", "alice", tenants.S, own);
      at("other-reverse", "sam", tenants.D, ids.sam.m.S!);
      at("other-real-person", "alice", tenants.S, ids.sam.m.S!);
      at("suspended", "suspended", tenants.D, ids.suspended.m.D!);
      at("no-membership", "loner", tenants.D, crypto.randomUUID());
      at("user-deactivated", "gone", tenants.D, ids.gone.m.D!);
      at("no-user", "ghost", tenants.D, own);
      at("company-inactive", "closedCo", tenants.closed, ids.closedCo.m.closed!);
      at("not-uuid", "alice", "not-a-company", own);
      at("upper-case", "alice", tenants.D.toUpperCase(), own);
      list.push({ id: `${bucket}:no-folder`, sub: ids.alice.sub, bucket, name: `${stamp + n++}-${FILE}` });
      list.push({ id: `${bucket}:leading-slash`, sub: ids.alice.sub, bucket, name: `/${pathFor(bucket, tenants.D, own, n++)}` });
      at("quote", "alice", `${tenants.D}' or '1'='1`, own);
      at("colleague", "alice", tenants.D, ids.bob.m.D!);
    }
    return list;
  }

  beforeAll(async () => {
    before = await snapshot();

    const client = new Client({ connectionString: CONNECTION });
    await client.connect();
    try {
      await client.query("begin");
      // If anything stalls, give up instead of holding locks: a policy
      // change locks storage.objects until this transaction ends.
      await client.query("set local lock_timeout = '5s'");
      await client.query("set local statement_timeout = '30s'");
      await client.query("set local idle_in_transaction_session_timeout = '60s'");

      // Read-only lookups: the two real companies and a role in each.
      const found = await client.query<{ id: string; slug: string; role: string }>(
        `select t.id, t.slug,
                (select r.id from public.roles r where r."tenantId" = t.id order by r.key limit 1) as role
         from public.tenants t where t.slug in ('demo-co', 'sunrise-traders-sample')`,
      );
      const bySlug = new Map(found.rows.map((r) => [r.slug, r]));
      const demo = bySlug.get("demo-co");
      const sample = bySlug.get("sunrise-traders-sample");
      if (!demo?.role || !sample?.role) {
        throw new Error("demo-co and sunrise-traders-sample (with roles) must exist for this test");
      }
      tenants.D = demo.id;
      tenants.S = sample.id;
      const roleFor: Record<Company, string> = { D: demo.role, S: sample.role, closed: demo.role };

      // Temporary rows, inside the transaction: a company that is not
      // active, the people, and their memberships.
      await client.query(
        `insert into public.tenants (id, slug, name, status, "updatedAt")
         values ($1, $2, $3, 'SUSPENDED', now())`,
        [tenants.closed, `${MARK}-${stamp}`, `${MARK} (closed)`],
      );
      for (const [key, person] of Object.entries(people) as Array<[keyof typeof people, (typeof people)[keyof typeof people]]>) {
        const entry = { sub: crypto.randomUUID(), userId: crypto.randomUUID(), m: {} as Partial<Record<Company, string>> };
        await client.query(
          `insert into public.users (id, "authUserId", email, "displayName", status, "updatedAt")
           values ($1, $2, $3, $4, $5::"UserStatus", now())`,
          [entry.userId, entry.sub, `${MARK}-${key}-${stamp}@example.invalid`, `${MARK} ${key}`, person.user],
        );
        for (const [company, status] of Object.entries(person.in) as Array<[Company, string]>) {
          const membershipId = crypto.randomUUID();
          const tenantId = tenants[company];
          await client.query(
            `insert into public.tenant_memberships (id, "tenantId", "userId", "roleId", status, "updatedAt")
             values ($1, $2, $3, $4, $5::"MembershipStatus", now())`,
            [membershipId, tenantId, entry.userId, roleFor[company], status],
          );
          entry.m[company] = membershipId;
        }
        ids[key] = entry;
      }
      // Signed in to Supabase, but no FlowHRMS user row at all.
      ids.ghost = { sub: crypto.randomUUID(), userId: "", m: {} };

      await client.query(HARNESS_SQL);
      const list = attempts();
      const run = async () => {
        const { rows } = await client.query<{ id: string; outcome: string }>(
          `select c.id, pg_temp.zz_try_upload(c.sub, c.bucket, c.name) as outcome
           from jsonb_to_recordset($1::jsonb) as c(id text, sub text, bucket text, name text)`,
          [JSON.stringify(list)],
        );
        return new Map(rows.map((r) => [r.id, r.outcome]));
      };

      // ---- locked from here until ROLLBACK: keep it short ----
      lockedMs = Date.now();
      await client.query(rollbackPolicySql().join(";\n"));
      results.old = await run();

      await client.query(applyPolicySql().join(";\n"));
      results.new = await run();

      const functions = await client.query(FUNCTION_STATUS_SQL);
      const grants = await client.query(
        `select has_function_privilege('public', 'private.is_active_member(text)', 'EXECUTE') as public_member,
                has_function_privilege('public', 'private.is_own_membership(text, text)', 'EXECUTE') as public_own,
                has_function_privilege('service_role', 'private.is_active_member(text)', 'EXECUTE') as service_member,
                has_function_privilege('authenticated', 'private.is_own_membership(text, text)', 'EXECUTE') as authenticated_own,
                has_schema_privilege('authenticated', 'private', 'USAGE') as authenticated_schema,
                has_schema_privilege('anon', 'private', 'USAGE') as anon_schema`,
      );
      const policies = await client.query(POLICY_STATUS_SQL);
      contract = { functions: functions.rows, grants: grants.rows[0], policies: policies.rows };

      // The same thing as plain statements from the client, no harness:
      // one allowed, one refused.
      const claims = (sub: string) =>
        `set local role authenticated;
         select set_config('request.jwt.claim.sub', '${sub}', true),
                set_config('request.jwt.claims', '{"sub":"${sub}","role":"authenticated"}', true);`;
      const safe = /^[A-Za-z0-9./_-]+$/;
      const ownDoc = documentPath(tenants.D, ids.alice.m.D!, FILE, stamp + 9_000);
      const strayDoc = documentPath(tenants.S, ids.alice.m.D!, FILE, stamp + 9_001);
      if (![ownDoc, strayDoc, ids.alice.sub].every((v) => safe.test(v))) throw new Error("unsafe literal");
      direct = { allowed: null, refused: null };
      await client.query(
        `savepoint zz_direct; ${claims(ids.alice.sub)}
         insert into storage.objects (bucket_id, name) values ('employee-documents', '${ownDoc}');`,
      );
      direct.allowed = "allowed";
      await client.query("rollback to savepoint zz_direct");
      try {
        await client.query(
          `savepoint zz_direct; ${claims(ids.alice.sub)}
           insert into storage.objects (bucket_id, name) values ('employee-documents', '${strayDoc}');`,
        );
      } catch (e) {
        const err = e as { code?: string; message?: string };
        direct.refused = { code: err.code, message: err.message };
      }
      await client.query("rollback to savepoint zz_direct");
      const role = await client.query<{ who: string }>("select current_user as who");
      if (role.rows[0].who !== "postgres") throw new Error(`still impersonating: ${role.rows[0].who}`);

      await client.query(rollbackPolicySql().join(";\n"));
      results.rolledBack = await run();
      const state = await client.query(FUNCTION_STATUS_SQL);
      const checks = await client.query<{ with_check: string }>(POLICY_STATUS_SQL);
      rolledBackState = { functions: state.rows.length, checks: checks.rows.map((r) => r.with_check) };
    } finally {
      // Nothing above may ever be committed.
      await client.query("rollback").catch(() => undefined);
      if (lockedMs) lockedMs = Date.now() - lockedMs;
      const left = await client
        .query<{ fn: string | null }>(`select to_regprocedure('pg_temp.zz_try_upload(text,text,text)')::text as fn`)
        .catch(() => ({ rows: [{ fn: "unknown" }] }));
      harnessLeft = left.rows[0].fn;
      await client.end();
    }

    after = await snapshot();
  });

  afterAll(() => {
    // A readable record of what was tried (ids only; no connection details).
    if (!results.new.size) return;
    const rows = [...results.new.entries()].map(([id, outcome]) => `${id.padEnd(40)} old=${results.old.get(id)} new=${outcome} rolled-back=${results.rolledBack.get(id)}`);
    console.log(
      `storage upload policy attempts (demo-co ${tenants.D}, sample ${tenants.S}; ` +
        `storage.objects locked ${lockedMs} ms):\n${rows.join("\n")}`,
    );
  });

  describe.each(BUCKETS)("%s, new rule", (bucket) => {
    it.each(CASES.map((c) => ({ ...c, outcome: wanted(c.want, bucket) })))(
      "$label → $outcome",
      ({ id, outcome }) => {
        expect(results.new.get(`${bucket}:${id}`)).toBe(outcome);
      },
    );
  });

  it("before: the old rule let every one of those uploads through", () => {
    expect(results.old.size).toBe(BUCKETS.length * CASES.length);
    for (const [id, outcome] of results.old) expect(outcome, id).toBe("allowed");
  });

  it("the same answers from plain client statements, without the harness", () => {
    expect(direct.allowed).toBe("allowed");
    expect(direct.refused?.code).toBe("42501");
    expect(direct.refused?.message).toMatch(/row-level security policy for table "objects"/);
  });

  it("functions: security definer, empty search_path, executable by authenticated only", () => {
    expect(contract.functions).toHaveLength(2);
    for (const fn of contract.functions) {
      expect(fn.security_definer).toBe(true);
      expect(fn.settings).toBe('{"search_path=\\"\\""}');
      expect(fn.authenticated_can_execute).toBe(true);
      expect(fn.anon_can_execute).toBe(false);
    }
    expect(contract.grants).toEqual({
      public_member: false,
      public_own: false,
      service_member: false,
      authenticated_own: true,
      authenticated_schema: true,
      anon_schema: false,
    });
  });

  it("policies: one INSERT policy per bucket for authenticated, nothing to read, change or delete", () => {
    expect(contract.policies.map((p) => p.policyname)).toEqual(
      [...BUCKETS].map((b) => policyName(b, "insert")).sort(),
    );
    for (const p of contract.policies) {
      expect(p.cmd).toBe("INSERT");
      expect(p.roles).toBe("{authenticated}");
      expect(String(p.with_check)).toMatch(/private\.is_(active_member|own_membership)\(/);
    }
    // Sanity: every bucket's rule names its own bucket.
    for (const b of BUCKETS) expect(UPLOAD_RULES[b]).toContain(`bucket_id = '${b}'`);
  });

  it("rollback: the old rule is back and the functions are gone", () => {
    expect(rolledBackState.functions).toBe(0);
    expect(rolledBackState.checks).toHaveLength(BUCKETS.length);
    for (const check of rolledBackState.checks) expect(check).toMatch(/^\(bucket_id = '[a-z-]+'::text\)$/);
    for (const [id, outcome] of results.rolledBack) expect(outcome, id).toBe("allowed");
  });

  it("nothing was committed: policies and functions as before, no test rows or objects", () => {
    expect(harnessLeft).toBeNull();
    expect(after.policies).toEqual(before.policies);
    expect(after.private_functions).toEqual(before.private_functions);
    expect(after.private_schema).toBe(before.private_schema);
    expect(after).toMatchObject({ test_objects: 0, test_users: 0, test_memberships: 0, test_tenants: 0 });
  });
});
