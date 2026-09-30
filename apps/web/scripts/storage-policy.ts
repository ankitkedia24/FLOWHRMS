/**
 * Who may upload where: the INSERT rules on storage.objects for the four
 * private buckets.
 *
 * WHY: browsers upload straight into storage with the signed-in person's
 * token. The first rule was only "signed-in users may insert into this
 * bucket", so anyone signed in to ANY company could write files into
 * another company's folder. They could never read those files or get them
 * recorded (src/lib/storage/paths.ts refuses such paths), but they could
 * fill someone else's storage. These rules close that: the first folder of
 * every path is the company, and only an active member of that company may
 * write there. Employee documents and expense receipts go one step further
 * — the second folder is the uploader's own membership, because only the
 * person themselves ever uploads those (MyDocuments.tsx, ClaimForm.tsx).
 *
 * Layout (src/lib/storage/paths.ts, src/lib/media/upload.ts):
 *   task-proof          {tenantId}/{taskId}/{stamp}-{name}
 *   employee-documents  {tenantId}/{membershipId}/{stamp}-{name}
 *   expense-receipts    {tenantId}/{membershipId}/{draftId}/{stamp}-{name}
 *   company-media       {tenantId}/{kind}/{stamp}-{random}.{ext}
 *
 * "Active member" means exactly what a session needs (src/lib/auth/
 * session.ts): the auth user's FlowHRMS user is ACTIVE, the membership is
 * ACTIVE and the company is ACTIVE. A person in several companies may
 * upload into each company they are active in.
 *
 * The membership check has to read public.users and
 * public.tenant_memberships, which the `authenticated` role cannot see
 * (RLS on, no policies — scripts/setup-rls.ts). So it lives in SECURITY
 * DEFINER functions in a `private` schema that the API does not expose,
 * with an empty search_path and fully qualified names, executable by
 * `authenticated` only. They answer yes or no and nothing else.
 *
 * Shared by scripts/setup-storage.ts (applies or rolls back) and
 * src/tests/storage-policy-integration.test.ts (proves both inside a
 * transaction that is rolled back).
 */

export const BUCKETS = ["task-proof", "employee-documents", "expense-receipts", "company-media"] as const;
export type Bucket = (typeof BUCKETS)[number];

/** A policy name per bucket and command, e.g. task_proof_authenticated_insert. */
export function policyName(bucket: Bucket, cmd: "insert" | "select" | "update" | "delete"): string {
  return `${bucket.replace(/-/g, "_")}_authenticated_${cmd}`;
}

/** The company folder and the folder below it, as storage splits a path. */
const FIRST_FOLDER = "(storage.foldername(name))[1]";
const SECOND_FOLDER = "(storage.foldername(name))[2]";

/** Upload rule now: the path's company (and, for personal files, person). */
export const UPLOAD_RULES: Record<Bucket, string> = {
  // Proof is filed under a task; whether this person may submit proof for
  // that task is checked when the path is recorded (submitProofAction).
  "task-proof": `bucket_id = 'task-proof' and private.is_active_member(${FIRST_FOLDER})`,
  "employee-documents": `bucket_id = 'employee-documents' and private.is_own_membership(${FIRST_FOLDER}, ${SECOND_FOLDER})`,
  "expense-receipts": `bucket_id = 'expense-receipts' and private.is_own_membership(${FIRST_FOLDER}, ${SECOND_FOLDER})`,
  // Admins upload the logo, animation and ID card design, and HR uploads
  // other people's photos, so the company is the only owner to check. The
  // second folder (logo, photos, …) is left open on purpose: a new kind of
  // media must not silently fail to upload until this script is re-run.
  "company-media": `bucket_id = 'company-media' and private.is_active_member(${FIRST_FOLDER})`,
};

/** The rule before batch 7, restored by `--rollback`. */
export function previousUploadRule(bucket: Bucket): string {
  return `bucket_id = '${bucket}'`;
}

/** A canonical, lower-case UUID — the only form the app ever writes. */
const UUID_PATTERN = "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$";

/**
 * The two membership checks. Anything that is not a lower-case UUID (a
 * missing folder, a name, an upper-case id) is simply "no" — never an
 * error — and is refused before it is cast. Both mirror getAppSession():
 * active user, active membership, active company.
 */
export const MEMBER_FUNCTIONS_SQL: string[] = [
  `create schema if not exists private`,
  `revoke all on schema private from public`,
  `grant usage on schema private to authenticated`,
  `create or replace function private.is_active_member(tenant_folder text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $fn$
begin
  if tenant_folder is null or tenant_folder !~ '${UUID_PATTERN}' then
    return false;
  end if;
  return exists (
    select 1
    from public.users u
    join public.tenant_memberships m on m."userId" = u.id
    join public.tenants t on t.id = m."tenantId"
    where u."authUserId" = auth.uid()
      and u.status = 'ACTIVE'
      and m.status = 'ACTIVE'
      and t.status = 'ACTIVE'
      and m."tenantId" = tenant_folder::uuid
  );
end
$fn$`,
  `create or replace function private.is_own_membership(tenant_folder text, membership_folder text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $fn$
begin
  if tenant_folder is null or tenant_folder !~ '${UUID_PATTERN}'
     or membership_folder is null or membership_folder !~ '${UUID_PATTERN}' then
    return false;
  end if;
  return exists (
    select 1
    from public.tenant_memberships m
    join public.users u on u.id = m."userId"
    join public.tenants t on t.id = m."tenantId"
    where m.id = membership_folder::uuid
      and m."tenantId" = tenant_folder::uuid
      and u."authUserId" = auth.uid()
      and u.status = 'ACTIVE'
      and m.status = 'ACTIVE'
      and t.status = 'ACTIVE'
  );
end
$fn$`,
  // Functions are executable by PUBLIC by default; only uploads need these.
  `revoke all on function private.is_active_member(text) from public, anon, service_role`,
  `revoke all on function private.is_own_membership(text, text) from public, anon, service_role`,
  `grant execute on function private.is_active_member(text) to authenticated`,
  `grant execute on function private.is_own_membership(text, text) to authenticated`,
];

function insertPolicySql(bucket: Bucket, rule: string): string[] {
  const name = policyName(bucket, "insert");
  return [
    `drop policy if exists "${name}" on storage.objects`,
    `create policy "${name}"
on storage.objects for insert to authenticated
with check (${rule})`,
  ];
}

/**
 * Everything the upload rules need, in order. Run it in one transaction so
 * there is never a moment with a bucket's policy dropped (and every upload
 * to it refused).
 *
 * No select/update/delete policy exists by design: reads are signed-URL
 * only, minted server-side after a permission check, and deletion is an
 * audited server-side operation. Any such policy found is dropped.
 */
export function applyPolicySql(): string[] {
  const statements = [...MEMBER_FUNCTIONS_SQL];
  for (const bucket of BUCKETS) {
    statements.push(...insertPolicySql(bucket, UPLOAD_RULES[bucket]));
    for (const cmd of ["select", "update", "delete"] as const) {
      statements.push(`drop policy if exists "${policyName(bucket, cmd)}" on storage.objects`);
    }
  }
  return statements;
}

/**
 * Back to the rule before batch 7 ("signed-in users may insert into this
 * bucket"), then remove the functions. The policies go first: they depend
 * on the functions. The `private` schema is removed only if nothing else
 * has been put in it since.
 */
export function rollbackPolicySql(): string[] {
  const statements: string[] = [];
  for (const bucket of BUCKETS) {
    statements.push(...insertPolicySql(bucket, previousUploadRule(bucket)));
  }
  statements.push(
    `drop function if exists private.is_own_membership(text, text)`,
    `drop function if exists private.is_active_member(text)`,
    `do $do$
begin
  drop schema if exists private;
exception when dependent_objects_still_exist then
  raise notice 'schema private kept: it holds other objects';
end
$do$`,
  );
  return statements;
}

/** What is in place now, for `--status` and after apply/rollback. */
export const POLICY_STATUS_SQL = `select policyname, cmd, roles::text as roles, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and (policyname like 'task_proof%' or policyname like 'employee_documents%'
    or policyname like 'expense_receipts%' or policyname like 'company_media%')
order by policyname`;

export const FUNCTION_STATUS_SQL = `select p.oid::regprocedure::text as function,
       p.prosecdef as security_definer,
       p.proconfig::text as settings,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'private' and p.proname in ('is_active_member', 'is_own_membership')
order by 1`;
