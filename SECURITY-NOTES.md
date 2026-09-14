# FlowHRMS Security Notes — Phase 1

Constraints come from the Product Constitution (§2 tenant isolation,
§3 explicit authority, §5 flag enforcement, §7 privacy). This file records
how Phase 1 implements them and what is deliberately deferred.

## Authorization layers (defence in depth)

1. `src/proxy.ts` — session refresh + signed-in gate. Nothing else.
2. `lib/auth/session.ts` — authenticated user → `User` row → one ACTIVE
   tenant membership with role + permissions. Users without a membership
   get no session (no "floating" authenticated access).
3. `lib/authz/*` — per-screen/per-action checks in the fixed order
   tenant → module → feature → permission → user exception. Pages call
   `requireSession` / `requireAdminArea` / `checkAccess` server-side.
   **UI hiding is never the control** — every admin route re-checks.

## Tenant isolation

- Every tenant-owned table carries `tenantId`; queries take it from the
  resolved session, never from client input.
- Cross-tenant access is platform-level only (Constitution §2) and is not
  implemented in Phase 1 — there is no impersonation path yet. When built,
  it must be justified, time-bound, logged, and show the persistent
  "Support session" warning band.
- Supabase Row Level Security is NOT yet enabled because all database
  access goes through the server (service role never reaches the client).
  Before production, enable RLS on all tenant tables as a second fence.

## Secrets and keys

- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is public by design (browser key).
- The database password and any `service_role`/secret key must exist only
  in `.env.local` / deployment secrets — both are gitignored. None are
  committed to this repo.
- No secrets are stored in application tables (SYSTEM-ARCHITECTURE.md).

## Account linking

On first sign-in, a Supabase account is linked to a provisioned `User`
row when `authUserId` is empty and the **verified** email matches
(`lib/auth/session.ts`). This suits the invited-users model (accounts are
created by the company). Before production: disable Supabase public
sign-ups so arbitrary people cannot create accounts, and move to an
explicit invite flow with tokens.

## Dev preview session (`FLOWHRMS_DEV_FAKE_SESSION`)

- Purpose: render the shell for UI review without Supabase or a database.
- Double-guarded: the flag AND `NODE_ENV === "development"`. Production
  builds ignore it entirely.
- It uses fixture data only ("Demo Trading Co. (placeholder)") and skips
  audit writes with a loud console warning.
- Risk accepted for Phase 1; remove or feature-gate the code path before
  any shared/staging deployment.

## Audit

`audit_events` is append-only: no update/delete in application code, no
`updatedAt` column. Sensitive-data access (salary, bank, documents,
location) must write an audit event when those features are built —
the helper (`lib/audit.ts`) exists and is the only sanctioned writer.

## File storage (task proof) — provisioned

The `task-proof` bucket exists and is configured by
`scripts/setup-storage.ts` (idempotent):

- **Private** (`public = false`). Nothing is served from a public path.
- 10 MB per file; JPEG, PNG, HEIC, WebP and PDF only.
- One policy: authenticated users may **INSERT**. There is deliberately no
  select, update or delete policy — reads go through short-lived signed
  URLs minted server-side in `lib/tasks/proof-access.ts` after the
  caller's tenant and permission are checked, and each view writes an
  audit event.
- Paths are `{taskId}/{timestamp}-{filename}`; the owning tenant is
  resolved from the task row, never from the path.

## Payroll data

- Salary structures, payroll lines and payslips are behind the sensitive
  `payroll.view` / `payroll.edit` / `payroll.approve` permissions.
- Employees can read only their own payslip, and only after the period is
  approved — a draft figure is never shown to the person it concerns.
- Reports export never includes salary or bank details; payroll figures
  leave through the payroll module, by someone with payroll permission.
- Approved runs are immutable: adjustments are appended with an actor and
  reason instead of editing a figure.

## Deferred to later phases (tracked, not forgotten)

- Supabase RLS policies on all tenant tables.
- Explicit invite/onboarding flow (tokens, not email matching).
- Rate limiting on auth endpoints.
- Session revalidation on permission change (USER-ROLES flow 9 requires
  server-side re-evaluation on the next request — the per-request
  entitlement loading already provides this; add cache invalidation when
  caching is introduced).
- File storage: private buckets, signed URLs, tenant-validated paths
  (SYSTEM-ARCHITECTURE.md security boundary) — with the Documents module.
- Retention windows for location, files, payroll and logs — must be
  defined before production (Constitution §7).

## The Supabase secret key

`SUPABASE_SECRET_KEY` (or the legacy `SUPABASE_SERVICE_ROLE_KEY`) is used
to create and update auth accounts when someone is invited. It bypasses
Row Level Security and can read every row in the project.

Three defences, in order of how much they can be relied on:

1. **`import "server-only"`** at the top of `src/lib/supabase/admin.ts`.
   A client component importing it — directly or through a chain — fails
   the build. This is the one that holds when someone is not thinking.
2. **No `NEXT_PUBLIC_` prefix**, so Next.js will not inline it into a
   client bundle even if the first defence were removed.
3. **Nothing in that module accepts a tenant id from a caller.** It only
   touches `auth.users`; tenant scoping happens in the calling action,
   against the session.

Absent configuration is a stated condition, not a crash: invitations are
refused with a message naming the missing key, so a half-configured
deployment is obvious rather than mysterious.

## Changing a password (Account → Change password)

Every signed-in person, whatever their role, can change their own
password at `/account` (`src/lib/account/actions.ts`). It is the second
of the two places FlowHRMS writes a password; the invitation page is the
other. The rules:

- **The current password is proved first.** A session cookie alone is
  not enough — an unlocked phone must not let someone lock its owner out.
  The proof is a sign-in with the current password from a throwaway
  Supabase client that keeps no session and is signed out again at once.
- **Wrong guesses are counted per person** — five in fifteen minutes,
  then a wait — in process memory (`PasswordAttemptLimiter`). The check
  leaves from the server, so Supabase's own per-IP sign-in limit sees one
  address for every company; without our limit, one person guessing could
  exhaust that shared allowance for everyone. The deployment is a single
  instance, so a restart forgetting a few counters is acceptable.
- **The change is announced to the person** in every channel: an audit
  event (`account.password_changed`), a bell notification, and an email
  when SMTP is configured. If it wasn't them, the email is how they learn.
- **"Sign out of other devices"** is an explicit choice, off by default
  (`signOut({ scope: "others" })`); the device making the change stays in.
- The password is never logged. `next.config.ts` turns off Next's
  development-only Server Function argument logging for the same reason.
- Forgot-password remains the path for someone who cannot prove the
  current one; that goes through Supabase's emailed link to `/reset`.

## Invitation tokens

- 32 bytes of CSPRNG output, base64url. Shown once, never stored.
- Only `sha256(token)` reaches the database, and it is the unique index —
  so a leaked backup yields no usable links.
- Comparison is constant-time (`timingSafeEqual`).
- Seven-day expiry, computed at read time. A row can say PENDING while the
  clock says expired; the clock wins, so no job is needed to keep the
  displayed status honest.
- **Single use**, enforced by a conditional `updateMany` on status rather
  than a read-then-write. Two tabs racing produce one acceptance.
- Every failure — wrong token, expired, revoked, already used — returns
  the same shape and reveals nothing about whether a token exists, so the
  page cannot be used to probe for live invitations.
- Resending **revokes** the previous token. An invitation that leaked
  cannot be revived by asking an admin to send it again.
- The invite page sets `robots: noindex` and `referrer: no-referrer`.

## Duplicate identities and the tenant boundary

Email and phone are unique platform-wide, which creates a way to probe for
whether an address is registered. So the message depends on where the
clash is:

- **In your own tenant** — the colleague is named. That is your data.
- **Anywhere else** — "This email address can't be used here. Use a
  different one for this person." True, actionable, and it does not
  confirm the address exists or say who holds it.

Employee IDs are scoped per tenant and may repeat across companies.
