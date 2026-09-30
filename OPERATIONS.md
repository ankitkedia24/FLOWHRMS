# FlowHRMS Operations

Practical procedures for running FlowHRMS. Written for whoever is on the hook
when something breaks — not as a compliance artefact.

## Environments

| | Where |
|---|---|
| Database | Supabase Postgres (`db.mcwuzmzslujnlzagijhc.supabase.co`) |
| Auth | Supabase Auth |
| Files | Supabase Storage, four private buckets: `task-proof`, `employee-documents`, `expense-receipts`, `company-media` |
| App | Next.js on Hostinger (standalone Node server) at https://hrms.flowacord.com; deploys itself from `main` of ankitkedia24/FLOWHRMS (DEPLOY.md §3b) |
| Email | SMTP, for account emails and the lockout codes; settings in Hostinger's environment |

## Secrets

| Secret | Where it lives | Rotate when |
|---|---|---|
| Database password | `apps/web/.env.local` (gitignored) and Hostinger's environment | At the end of the project (owner's plan) — it was shared in chat during development. Supabase → Settings → Database → Reset password, then update both places. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Both | Public by design; rotate only if the project is compromised |
| `SUPABASE_SECRET_KEY` (service role) | Both; server code only (`lib/supabase/admin.ts`) | If it leaks: it bypasses row-level security. Used to create sign-ins and to sign file links |
| `SMTP_PASSWORD` | Both | If it leaks, or when the mailbox password changes |
| `GOOGLE_MAPS_SERVER_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Both | If they leak; keep the public one restricted to hrms.flowacord.com in Google Cloud |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Hostinger, once online payment is switched on | If they leak |

No secret is stored in application tables, and none is committed.

## Backup and restore

Supabase takes automatic daily backups on paid plans; free projects do
not. **Check which you have before relying on it** (Supabase → Database →
Backups).

Manual backup (works on any plan):

```bash
pg_dump "$DIRECT_URL" --no-owner --no-privileges -Fc -f flowhrms-backup.dump
```

Restore into a scratch project to rehearse:

```bash
pg_restore --no-owner --no-privileges -d "$SCRATCH_DIRECT_URL" flowhrms-backup.dump
```

**Rehearse the restore before the pilot.** A backup nobody has restored is
a hope, not a backup. This has **not** been rehearsed yet — it needs a
second Supabase project, which is the customer's call to create.

Storage buckets are **not** covered by a database dump. Files must be
copied separately (Supabase CLI `storage download`, or the dashboard).

## Migrations

```bash
npx prisma migrate deploy    # apply
npx prisma migrate status    # confirm
```

Migrations are additive and hand-reviewed. Two rules that have held so
far and should keep holding:

- **Never rewrite history.** Past attendance keeps the policy version and
  branch snapshot it was recorded with. A migration that "corrects" old
  rows destroys evidence.
- **Never guess.** The multi-location migration deliberately did not
  assign anyone a work location; it left the gap visible instead.

Rollback: each migration file names its own reversal in a comment where
one is not obvious.

## Row Level Security

RLS is enabled on all 25 tenant tables with no permissive policy, so the
anon and authenticated API keys can read nothing. The app connects as the
table owner and is unaffected.

```bash
cd apps/web
npx tsx scripts/setup-rls.ts --status     # report
npx tsx scripts/setup-rls.ts              # apply (idempotent)
npx tsx scripts/setup-rls.ts --rollback   # undo
```

If a screen suddenly returns empty after a database change, check
`--status` first: a new table added without RLS is a hole, and a new
connection role that is not the owner will read nothing.

## The offline queue

Employee attendance, leave and task proof are queued in **IndexedDB on the
employee's own device** when there is no connection, and sent on
reconnect, on page load, and when the tab becomes visible. Two operational
consequences:

- **Queued work is not on the server and cannot be recovered by you.** If
  someone signs out and discards, or clears their browser data, it is
  gone. The app warns before both.
- **A queued action records its capture time, not its arrival time.** So
  `checkInAt` for a row with `offlineCaptured = true` can be hours before
  `createdAt`. That is correct and deliberate — do not "fix" it.

Two guards that generate support questions:

| Symptom | Cause | Fix |
|---|---|---|
| "This phone's clock is ahead of ours" | Device clock >2 min in the future | Set the phone to automatic time |
| "…can't be sent now" on an old item | Queued item older than 7 days | Manager records the day manually |

Useful queries when investigating a disputed day:

```sql
select "workDate", "checkInAt", "checkInClientAt", "offlineCaptured", "conflictNote", "reviewStatus"
from attendance_records where "tenantId" = $1 and "offlineCaptured" order by "createdAt" desc;
```

A non-null `conflictNote` means a queued check-in arrived for a day that
already had one. The saved record stands; both times are in the note and
the day is raised for review. `attendance.sync_conflict` in
`audit_events` records the same thing with the actor.

Retried leave requests and proofs are deduplicated by
`(tenantId, clientRequestId)`. A unique-constraint violation on that pair
is the mechanism working, not a bug.

## Incidents

1. **Contain.** If data may be exposed, rotate the database password and
   the publishable key immediately, and disable public sign-ups
   (Supabase → Authentication → Providers).
2. **Preserve evidence.** `audit_events` is append-only and is the record
   of who did what. Do not delete rows to tidy up.
3. **Assess scope.** Query `audit_events` by `tenantId` and time window.
   Sensitive-data access (`employee.salary_viewed`, `document.viewed`,
   `report.exported`) is logged with the actor.
4. **Tell the customer.** They own the data. Say what happened, what was
   accessible, and what you did — in the same plain language the product
   uses.
5. **Write it down.** Add a dated entry to `DECISIONS.md` if the fix
   changes behaviour.

## Suspending a company

From `/platform` or a company's page: **Suspend** → say why → **Email the
code** → a 6-digit code arrives at **info@flowacord.com** → type it →
**Suspend this company**. "End trial now" works the same way. The code
works once, for ten minutes, only for the person who asked (DECISIONS.md
D-PL-01).

- A code email nobody expected means someone with platform access is
  trying to lock a company out: don't share the code, and check who has
  platform access (`cd apps/web`, then
  `npx tsx scripts/grant-platform-admin.ts --list`).
- If email is down, nothing can be suspended from the product — by
  design. Fix the SMTP settings first.
- Restoring needs only a reason.

## Support access

There is **no impersonation feature**, deliberately. If support needs to
see a tenant's data, it is a database query by someone with the password,
and it is not currently logged as an audit event. Before the pilot, either
build the support-session flow the design specifies (persistent
non-dismissible warning band, time-bound, every action attributed to the
real operator) or agree in writing that support does not access customer
data.

## Monitoring

Not set up. Before a pilot, at minimum: uptime check on the app, Supabase
project health alerts, and a weekly look at `audit_events` for unexpected
sensitive-data access.

## Known gaps

- Backup restore not rehearsed.
- No uptime monitoring or error alerting (production has run on Hostinger since September 2026).
- No support-session flow — or, instead, a written rule that support never opens customer data (see *Support access*).
- Storage files are not in the database backup.
- Scheduled daily summaries need a notification provider.
