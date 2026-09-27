/**
 * Enable Row Level Security on every tenant-owned table.
 *
 * WHY, given the app already scopes every query by tenant:
 * defence in depth. If a future query forgets its `tenantId`, or someone
 * obtains the anon/authenticated key, RLS is the fence that still holds.
 * The app connects as the table owner (postgres), which BYPASSES RLS, so
 * enabling this does not change application behaviour — it removes a way
 * for anything *else* to read the data.
 *
 * What this deliberately does NOT do: write per-tenant USING policies
 * keyed on a JWT claim. The app resolves tenancy server-side from the
 * session, not from a database role, so a claim-based policy would be
 * decoration — it would never be consulted on the path we actually use.
 * Locking the tables to the owner is the honest version of that promise.
 *
 * Usage:
 *   npx tsx scripts/setup-rls.ts            apply
 *   npx tsx scripts/setup-rls.ts --status   report only
 *   npx tsx scripts/setup-rls.ts --rollback undo
 */
import { config as loadEnv } from "dotenv";
import { Client } from "pg";

loadEnv({ path: [".env.local", ".env"], quiet: true });

/** Every table that holds tenant-owned data. */
const TENANT_TABLES = [
  "tenants",
  "tenant_memberships",
  "roles",
  "role_permissions",
  "tenant_module_settings",
  "tenant_feature_settings",
  "user_feature_exceptions",
  "tenant_policies",
  "audit_events",
  "branches",
  "shifts",
  "attendance_records",
  "attendance_punches",
  "performance_events",
  "employee_badges",
  "performance_boosts",
  "rewards",
  "reward_redemptions",
  "kudos",
  "leave_requests",
  "tasks",
  "task_proofs",
  "proof_files",
  "notifications",
  "employee_documents",
  "salary_components",
  "salary_structures",
  "salary_structure_lines",
  "payroll_runs",
  "payroll_lines",
  "payroll_adjustments",
  "departments",
  // Invitation tokens are hashed, but the row still says who was invited
  // to which company and when — tenant data either way.
  "employee_invites",
  "action_requests",
  "action_request_recipients",
  "users",
  // Not tenant-owned — a prospect has no company here yet — but it holds
  // the name and phone number of people who are not even customers. If
  // anything on this list deserves a second fence, it is this.
  "demo_requests",
  // Expenses (EXPENSES-MODULE.md §9): claims carry amounts and receipts.
  "expense_claims",
  "expense_receipts",
  "expense_claim_transitions",
  "expense_settlements",
  "expense_counters",
  // DPDP consent proof and rights requests: personal data about people
  // who may not even be customers any more. Same fence as everything else.
  "consent_notices",
  "consent_records",
  "data_requests",
  "email_verifications",
  "platform_settings",
  // Billing: what each company paid, and the tax invoices issued for it.
  "billing_plans",
  "billing_payments",
  "invoice_counters",
  // Job titles and the access each carries.
  "designations",
  // Sign-up codes: hashes only, but tied to emails and phone numbers.
  "signup_verifications",
];

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL / DIRECT_URL is not set. See SETUP.md.");
  process.exit(1);
}

const client = new Client({ connectionString });
const mode = process.argv.includes("--rollback")
  ? "rollback"
  : process.argv.includes("--status")
    ? "status"
    : "apply";

async function report() {
  const { rows } = await client.query(
    `select c.relname as table, c.relrowsecurity as rls_enabled,
            (select count(*) from pg_policies p
              where p.schemaname = 'public' and p.tablename = c.relname) as policies
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
       and c.relname = any($1)
     order by c.relname`,
    [TENANT_TABLES],
  );
  const on = rows.filter((r) => r.rls_enabled).length;
  console.table(rows);
  console.log(`RLS enabled on ${on} of ${rows.length} tenant tables.`);
}

async function main() {
  await client.connect();

  if (mode === "status") {
    await report();
    return;
  }

  for (const table of TENANT_TABLES) {
    const exists = await client.query(
      `select 1 from information_schema.tables
       where table_schema = 'public' and table_name = $1`,
      [table],
    );
    if (exists.rowCount === 0) {
      console.warn(`skipped ${table} — not found`);
      continue;
    }

    if (mode === "rollback") {
      // Rollback path, written before the apply path was ever run.
      await client.query(
        `alter table public."${table}" disable row level security`,
      );
      await client.query(
        `drop policy if exists "stf_owner_only" on public."${table}"`,
      );
      continue;
    }

    await client.query(
      `alter table public."${table}" enable row level security`,
    );
    // No permissive policy for anon/authenticated: nothing may read these
    // tables through the API keys. The application connects as the owner
    // and is unaffected.
    await client.query(
      `drop policy if exists "stf_owner_only" on public."${table}"`,
    );
  }

  console.log(
    mode === "rollback"
      ? "RLS disabled on all tenant tables."
      : "RLS enabled on all tenant tables.",
  );
  await report();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => client.end());
