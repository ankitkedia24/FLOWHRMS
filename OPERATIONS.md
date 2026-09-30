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

**Weekly, from the office computer** (Google Drive for desktop signed in,
PostgreSQL 17 installed):

```bash
npm run backup --workspace=@flowhrms/web
npm run backup-rehearse --workspace=@flowhrms/web
```

The first saves one encrypted file to `G:\My Drive\FlowHRMS-Backups`
(`BACKUP_DIR` changes the folder). It holds the database — company data and
sign-ins — and every file in the four storage buckets. The second opens the
newest backup, restores the company data into a throwaway database on the
same computer, checks every table's rows and every file against the counts
taken when the backup was made, and deletes the throwaway database. Both
show on **/platform/system**, which warns once the last backup is a week
old.

- **The passphrase** — `BACKUP_PASSPHRASE` in `apps/web/.env.local`, at
  least 12 characters — is the only way to open a backup. Keep a copy
  outside this computer, in a password manager. Lose it and every backup
  is unreadable.
- Supabase takes its own daily backups only on paid plans (Supabase →
  Database → Backups). These backups are ours either way, and unlike
  Supabase's they include the stored files.
- Old backups are never deleted automatically; remove old ones from the
  Drive folder by hand.

**A real restore** (the Supabase project is lost):

1. Open the backup into an empty folder:
   `npm run backup-open --workspace=@flowhrms/web -- --file "<backup>.fhbk" --to "<empty folder>"`.
2. Create a new Supabase project. Restore the company data:
   `pg_restore --no-owner --no-privileges --schema=public -d "<new DIRECT_URL>" database.dump`.
   Point `apps/web/.env.local` and Hostinger at the new project, then run
   `npm run db:migrate` (nothing should be left to apply),
   `npx tsx scripts/setup-rls.ts` and `npm run setup-storage` (both in
   `apps/web`).
3. Upload `files/<bucket>/…` back into the same four buckets, same paths.
4. Sign-ins are in the backup (the `auth` schema), but restoring them into
   a new Supabase project **has not been rehearsed**. Until it has, plan on
   people setting new passwords through "Forgot password".
5. Delete the opened folder: it is unencrypted personal data.

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

`/platform` → the company → **Support** → **Open as support** puts you
inside the company with the Owner's access until you press **Exit support**
(docs/md/SUPPORT-ACCESS.md). The company sees no banner; changes you make
show in its Activity log as "Flowacord support". Sessions are listed on
/platform/system.

**Until the updated Terms are reviewed and published, only the placeholder
and sample companies can be opened.** A database query by someone with the
password is still possible and still unrecorded — don't use it for support.

## Monitoring

Everything below is on **/platform/system** (platform admins only).

- **Crashes.** Server errors on the live site are recorded there, grouped
  by kind, and the first of each kind in an hour is emailed to
  info@flowacord.com (`src/instrumentation.ts`, `lib/platform/errors.ts`).
  Email addresses and long numbers are removed from messages first.
- **Uptime.** `https://hrms.flowacord.com/api/health` answers
  `{"status":"ok"}` with 200 when the site and its database answer, and
  503 when the database doesn't. It shows nothing else. Point an outside
  monitor at it — for example UptimeRobot (free): an HTTP(s) keyword
  monitor on that address, every 5 minutes, keyword `ok`, alerts by email
  and SMS to you. **Not set up yet:** it needs an account only you can
  create.
- **Lockout codes.** Every code asked for to suspend a company or end a
  trial, who asked, why, and whether it was used.
- Still worth a weekly look at `audit_events` for unexpected
  sensitive-data access.

## Known gaps

- No outside uptime monitor yet (the health check is ready; see *Monitoring*).
- A restore into a new Supabase project, sign-ins included, hasn't been
  rehearsed; the weekly rehearsal restores company data into a local
  throwaway database.
- Support access to real companies waits on the lawyer-reviewed Terms (docs/md/SUPPORT-ACCESS.md).
- Scheduled daily summaries need a notification provider.
