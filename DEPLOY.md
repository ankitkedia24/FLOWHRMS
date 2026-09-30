# Going live

A runbook for putting FlowHRMS on the internet for a real company. Ordered so
that each step unblocks the next. Times are honest estimates for someone
doing it the first time.

**Read the two warnings at the bottom before you onboard real employees.**

---

## 0. Decide the two accounts you are paying for (10 min)

| | Free tier | Why that is not enough for a customer |
|---|---|---|
| **Supabase** | Project **pauses after 7 days** of inactivity; no daily backups | A paused project is a dead app on a Monday morning. Pro is $25/mo and adds daily backups. |
| **Vercel** | Hobby is licensed for **non-commercial use only** | You are charging a customer. Pro is $20/mo. |

You can deploy on free tiers to test today, but move both to paid before
the customer's employees depend on it. Nothing in the code changes.

**Check your Supabase region now** (Supabase → Settings → General). If the
project is not in `ap-south-1` (Mumbai) and your customer is in India,
every page load pays a round trip across the world. Moving regions means
creating a new project and restoring a dump — much cheaper to do now than
in a month.

---

## 1. Rotate the database password (5 min) — do this first

The current password was typed into a chat window and is in this
conversation's history.

1. Supabase → Settings → Database → **Reset database password**
2. Save the new one in a password manager
3. Update your local `.env.local`
4. Confirm: `npx prisma migrate status`

Everything below uses the new password.

---

## 2. Get the two connection strings (5 min)

**Use the pooler. Never the direct host.** This is not a tuning
preference — `db.<ref>.supabase.co` has *zero* A records, only AAAA.
Hostinger's containers are IPv4-only, so Prisma cannot open a socket to it
at all. Confirmed on this project, 10 August 2026.

The failure is nastier than an outage, because the site keeps working:
marketing pages render, sign-in renders, redirects redirect — and every
database query throws a 500. It reads like an application bug.

The pooler hostnames do have IPv4. **This is the configuration running in
production, verified end to end on 11 August 2026:**

| Variable | Pooler | Port |
|---|---|---|
| `DATABASE_URL` | Transaction | **6543** (with `?pgbouncer=true`) |
| `DIRECT_URL` | Session | **5432** |

That split is Supabase's own recommendation on the Connect → ORM → Prisma
tab, and it is what the app is running on. Take both strings from that
tab rather than editing one into the other.

Shape (copy from Supabase → **Connect** → ORMs → Prisma, do not type it):

```
postgresql://postgres.<project-ref>:<password>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres
```

**Three ways this goes wrong, all seen on this project:**

1. **The username is different for the pooler.** It is
   `postgres.<project-ref>`, not `postgres`. The wrong one fails with
   *"Tenant or user not found"*.
2. **The region must match your project.** A wrong region gives the same
   *"Tenant or user not found"*, which is misleading. `ap-south-1` is
   correct here.
3. **Paste it as one unbroken line**, with no surrounding quotes. The
   panel has separate Key and Value fields; the value is everything
   between the quotes in Supabase's snippet, nothing more.

### `Can't reach database server at 'base'` means the placeholder is still there

This error cost hours, so it is worth stating exactly. It does **not**
mean a network problem, a wrong region or a line break. It means the
variable still contains placeholder text such as
`<paste connection string>`.

Postgres connection strings without a `://` scheme are parsed as
keyword/value pairs, and any such placeholder resolves to a host named
literally `base`. Reproduced directly:

```
host="base"   <- "<paste connection string>"
host="base"   <- "<transaction pooler string, port 6543>"
host="aws-0-ap-south-1.pooler.supabase.com"  <- a real string
```

**If you see `base`, stop debugging the network and go look at the
variable.**

### Set the variables at creation, with Import .env — do not edit them later

The placeholders above survived three separate attempts to correct them in
the panel. Edited values appear in the table immediately, but the save
does not stick: reload, and the old value is back. Every redeploy in
between shipped the stale value while the panel showed the new one, which
is what made it so hard to see.

**Import .env at app-creation time is the path that actually persists.**
So the reliable procedure is:

1. Build a complete `.env` file locally with real values — every variable,
   no placeholders. Test the connection strings *before* uploading
   (`scripts/verify-production.ts check` proves them).
2. Create the Web App and use **Import .env** on the environment step.
3. Deploy.

If a value later needs changing and editing does not hold, delete the Web
App and recreate it with a corrected file. That sounds heavy-handed; it
took ten minutes and was faster than the alternative.

Deleting a Web App destroys nothing that matters — every record lives in
Supabase, so an app container is only a build and a process.

If the password contains `@ : / ? # [ ] %`, URL-encode it (`@` → `%40`),
or rotate to one without them. An unencoded character silently changes
where the parser thinks the host starts.

Verify before deploying:

```bash
nslookup -type=A db.<ref>.supabase.co
```

No answer confirms direct will not work from an IPv4-only host.

---

## 3. Deploy to Vercel (20 min)

1. [vercel.com](https://vercel.com) → sign in **with GitHub**
2. **Add New → Project** → import `INETIAFLOW/FlowHRMS`
3. Framework preset: **Next.js** (auto-detected). Leave the build and
   output settings alone — the repo already runs `prisma generate` as part
   of its build.
4. **Environment Variables** — add these to *Production* **and**
   *Preview*:

```
NEXT_PUBLIC_SUPABASE_URL=https://mcwuzmzslujnlzagijhc.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_71oQXHaySqLbSXlyUyX-iw_d4u16_er
DATABASE_URL=<transaction pooler string, port 6543>
DIRECT_URL=<session pooler string, port 5432>
SUPABASE_SECRET_KEY=<Settings → API Keys → secret key, sb_secret_…>
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
```

   **`SUPABASE_SECRET_KEY` is what lets you add employees.** Without it,
   people can be added to the directory but no sign-in account is created,
   and the invitation page says so. Get it from Supabase → Settings → API
   Keys → *secret key* (or the legacy `service_role` key).

   ⚠️ That key bypasses Row Level Security and can read every row in the
   project. It has no `NEXT_PUBLIC_` prefix, and the module that uses it is
   marked `server-only` so a client component importing it fails the build
   rather than shipping it to a browser. Treat it like the database
   password: never in a commit, never in a client component, rotated if
   exposed.

   Do **not** set `FLOWHRMS_DEV_FAKE_SESSION`. It is ignored outside
   development, but there is no reason for it to exist in production.

5. **Deploy.** First build is ~3 minutes.
6. Settings → Functions → **Region**: set it to match your Supabase region.

You now have a URL like `flowhrms-xyz.vercel.app`. It will load the marketing
pages. Sign-in will not work correctly until step 5.

### 3b. Hostinger — the repository is a monorepo (since 29 Sept 2026)

Production (hrms.flowacord.com) deploys from `ankitkedia24/FLOWHRMS` on
Hostinger. Since the monorepo change the web app lives in `apps/web`, the
mobile app in `apps/mobile`, shared code in `packages/*`, and Prisma stays at
the root (`prisma/`, `prisma.config.ts`). Hostinger runs its usual three
commands **at the repository root**, and the root `package.json` turns each
into the web app's:

| Hostinger runs | Root script does |
|---|---|
| `npm install` | installs every workspace, then `postinstall` → `prisma generate` |
| `npm run build` | `prisma generate`, `next build --webpack` in `apps/web` (standalone output), then `scripts/mirror-web-build.mjs` copies the build to the root `.next` and lays out `.next/standalone` |
| publish | "Detected Next.js standalone server output": Hostinger copies `.next/standalone` to a new version and runs its `server.js` — it does **not** call `npm start` |

- The web app builds with `output: "standalone"` (apps/web/next.config.ts).
  Before the monorepo Hostinger added that itself to the root next.config;
  with no root config it can't, which is why the monorepo deploys failed.
- In a monorepo Next puts the server at `.next/standalone/apps/web/server.js`;
  the mirror script adds `.next/standalone/server.js` (starts that one) and
  copies `.next/static` and `public` beside it, so the standalone folder is
  complete on its own.
- The two failures this fixes (29 Sept 2026): "No output directory found
  after build" (no root `.next`), then "Next.js build produced no standalone
  server or static output" (no `server.js` at the top of `.next/standalone`).
  In both, the build itself had succeeded — read the last lines of the log.
- Leave Hostinger's settings as they are (root `./`, output `.next`).
- To run exactly what Hostinger runs, locally: `npm run build`, copy
  `.next/standalone` anywhere, and run `node server.js` there with the
  environment variables set (PORT, DATABASE_URL, …).
- Environment variables are unchanged (set in Hostinger's panel).
- Locally, `.env.local` lives in `apps/web/.env.local`; `prisma.config.ts`
  reads it from there as well.
- `npm install` also installs the Expo mobile app's packages; that is
  expected and only makes the install slower.

---

## 4. Point a domain at it (30 min, plus DNS propagation)

Buy a domain if you have not (`.in` or `.com`, ~₹800–1200/yr). In Vercel →
Settings → Domains → add it, then create the records your registrar asks
for. HTTPS is automatic.

Use a real domain rather than the `.vercel.app` URL: you will need it for
email (step 6) and it is what the customer's staff will type on their
phones every morning.

---

## 5. Tell Supabase about the domain (5 min) — sign-in breaks without this

Supabase → Authentication → **URL Configuration**:

- **Site URL**: `https://yourdomain.com`
- **Redirect URLs**: add `https://yourdomain.com/**`

Skip this and password-reset emails will send people to `localhost:3000`.

---

## 6. Set up real email (45 min) — nothing works without it

**This is the step people skip and regret.** Supabase's built-in email
service sends only a handful of messages per hour and is explicitly for
testing. With it, a 30-person rollout stalls after the first few and the
failures are silent.

1. Sign up for an email provider — [Resend](https://resend.com) is the
   quickest (free tier covers a pilot). Brevo and AWS SES also work.
2. Verify your domain there (a few DNS records — SPF/DKIM).
3. Supabase → Authentication → Emails → **SMTP Settings** → enter the
   provider's host, port, user and password, and a sender address at your
   own domain.
4. Send yourself a password reset from `/forgot-password` and confirm it
   arrives and the link opens `/reset` on your domain.

While you are there, edit the email templates (Authentication → Emails).
The defaults say "Supabase", which is confusing for a warehouse
supervisor.

---

Point Supabase's SMTP settings and FlowHRMS's `SMTP_*` variables at the **same
provider account** — one set of credentials, two consumers (Supabase sends
password resets, FlowHRMS sends invitations).

## 7. Create the customer's company (10 min)

### First time only: give yourself the platform area

Companies are created from **`/platform`**, which is reachable only by a
Platform Super Admin. That is a single flag on your user record, and
nothing inside the product can grant it — no role, no permission, no
screen. Sign in to FlowHRMS once so your user exists, then:

```bash
npx tsx scripts/grant-platform-admin.ts --email you@yourcompany.com
```

`--list` shows who has it, `--revoke` takes it away. Keep the number of
people holding it small: it is the only privilege in FlowHRMS that sees across
companies.

### Every customer after that

Open **`/platform` → Add a company**. Fill in the company name, the
owner's name and the owner's email. You get back a **one-time invitation
link, valid 7 days** — send it to the owner however suits (email,
WhatsApp).

That single step creates the company, its roles and their permissions, and
its module and feature entitlements from the catalog.

**Nobody's password is set, by you or by anyone.** The owner chooses their
own on the invitation page, and their Supabase auth account is created at
that moment. There is no step here where you create an auth user by hand
and no step where a password passes through you — which is the point: you
cannot leak what you never hold, and the owner is onboarded through
exactly the flow their staff will use.

If you would rather not use the browser, the same thing from a terminal:

```bash
npx tsx scripts/create-tenant.ts --name "Acme Hardware" --owner-email owner@acme.example --owner-name "Priya Shah"
```

Add `--dry-run` to see what it would do first. Both routes run the same
code (`src/lib/platform/provision.ts`), so they cannot drift apart.

### Then hand over

The owner signs in and sets up locations, shifts, rules, departments and
modules themselves. `PILOT.md` is written to be handed to them for this.
Everyone after the owner is added from the screen — see *Adding the rest
of the team* below.

**Watch for demo data.** If this database was ever seeded for development,
delete the demo tenant before the customer signs in. Placeholder people
appearing in a real company's directory is the kind of thing a customer
never forgets.

```bash
npx tsx scripts/delete-tenant.ts --slug demo-co --confirm demo-co
```

Without `--confirm` it only reports what it would delete. The slug is
typed twice on purpose — this removes a company and everything in it.

---

## 7b. Consent notices — before every deploy that changes them

Sign-up, invitation acceptance and the consent screen record consent to
the **published** copy of each notice (DPDP; see docs/md/DPDP-COMPLIANCE.md),
and refuse if the deployed text and the published text differ. So, in this
order, whenever a migration or a notice changes:

```bash
npm run db:migrate            # schema first (additive migrations)
npx tsx scripts/setup-rls.ts  # keep every table behind row-level security
npm run publish-notices       # then the exact texts people will consent to
```

`publish-notices` is safe to repeat. It refuses to re-publish a changed text
under an old version number — bump `version` in src/lib/consent/documents.ts
instead; everyone is then asked to consent again on their next visit.

## 7c. Online payment (Razorpay) — so companies can pay in the app

Companies choose a plan and pay at **/subscription** (Owner, Tenant Super
Admin or Admin). Until both steps below are done they see the prices and a
"Online payment opens shortly" note instead of a Pay button.

1. **Flowacord's invoice details** — in the app, Platform → **Billing**:
   legal name, GSTIN, address, state (must match the GSTIN), SAC code
   (997331 is pre-filled; confirm it with your CA). These are printed on
   every tax invoice.
2. **Razorpay keys** — Razorpay Dashboard → Account & Settings → API keys.
   Start with **Test mode** keys (`rzp_test_…`): no real money moves, and the
   app says "Test mode" on the payment page. Add three environment
   variables to `.env.local` and to Hostinger → Environment variables, then
   redeploy:

   | Variable | Where it comes from |
   |---|---|
   | `RAZORPAY_KEY_ID` | API keys → Key Id |
   | `RAZORPAY_KEY_SECRET` | API keys → Key Secret (shown once) |
   | `RAZORPAY_WEBHOOK_SECRET` | a secret you choose in step 3 |

   Never paste these into chat, email or a commit.
3. **Webhook** — Razorpay Dashboard → Webhooks → Add: URL
   `https://hrms.flowacord.com/api/razorpay/webhook`, the secret from
   step 2, events `payment.captured`, `order.paid`, `payment.failed`. This
   marks a company paid even if the customer closes the tab before the
   payment page reports back.

Going live is the same three variables with the `rzp_live_…` keys, and a
webhook added in Live mode. Prices, modules and the "Popular" plan are
edited in Platform → **Plans**. Payments never renew by themselves: a paid
period ends at `paidUntil`, everything keeps working for 7 more days, then
the company pauses until it pays (nothing is deleted).

## 7d. Google Maps — address search when adding a work location

Adding a work location offers "Use my current location" and typed
coordinates without any setup. Searching an address and dragging a pin
needs a Google Maps key:

1. Google Cloud Console → a project with billing on → enable **Maps
   JavaScript API**, **Places API (New)** and **Geocoding API**.
2. Credentials → Create API key → restrict it: *Websites* =
   `https://hrms.flowacord.com/*` and `http://localhost:3100/*`; *APIs* =
   the three above.
3. Add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to `.env.local` and Hostinger →
   Environment variables, then **rebuild** (a `NEXT_PUBLIC_` value is baked
   in at build time).

This key is meant to be seen by browsers; the website restriction is what
protects it. The free monthly allowance covers normal use.

## 7e. Road distance — field visits and travel allowance

Field visits record a straight-line estimate between tapped spots straight
away, and replace it with the road distance once a server key exists. The
estimate is always marked "about"; nothing breaks without the key.

1. Google Cloud Console → the same project → enable **Routes API**.
2. Credentials → Create API key → restrict it: *APIs* = **Routes API**
   only. (No website restriction: it is called by the server, never a
   browser. Add an IP restriction if Hostinger gives a fixed outbound IP.)
3. Add `GOOGLE_MAPS_SERVER_KEY` to `.env.local` and Hostinger →
   Environment variables, then restart. No rebuild needed — it is not
   `NEXT_PUBLIC_`.

Cost: one route per stretch between taps (a trip with three visits is four
stretches; stretches under 50 m are not sent). Paid by Flowacord, not the
customer. Set a budget alert on the Cloud project. Route lines for the map
are dropped after 30 days; the distance itself is kept as a business
record for travel claims.

## 7f. File storage — who may upload where

Browsers upload files straight into the four private Supabase Storage
buckets; the database policy on `storage.objects` decides what is
accepted. Until hardening batch 7 it was only "any signed-in user may
upload into this bucket", so someone signed in to one company could put
files into another company's folder (never read them, never get them
recorded — but fill the space). Now the first folder of every path is the
company, and it has to be one the uploader is an **active member** of
(active user, active membership, active company — what signing in needs):

| Bucket | Path | May upload |
|---|---|---|
| `task-proof` | `{tenantId}/{taskId}/…` | an active member of that company |
| `employee-documents` | `{tenantId}/{membershipId}/…` | only that person, into their own folder |
| `expense-receipts` | `{tenantId}/{membershipId}/{draftId}/…` | only that person, into their own folder |
| `company-media` | `{tenantId}/{kind}/…` | an active member of that company |

The check is two small `SECURITY DEFINER` functions in a `private` schema
that the API does not expose, `private.is_active_member(tenant)` and
`private.is_own_membership(tenant, membership)`, executable by signed-in
users only (scripts/storage-policy.ts). There is still no select, update or
delete policy: files are read only through links the server signs.

**Only after the batch 2–6 build is live.** Before batch 3 the app uploaded
documents to `{membershipId}/…`, proof to `{taskId}/…` and receipts to
`{tenantId}/{draftId}/…`; this rule refuses all three. So deploy the app
first (Hostinger shows the deploy of `f8385e0` or later), then apply.
Nothing about the app needs to change afterwards.

**Apply** (once; safe to repeat), from the repository root:

```bash
npm run setup-storage --workspace=@flowhrms/web
```

(or `cd apps/web && npm run setup-storage`). It reads `DIRECT_URL` from
`apps/web/.env.local`, makes every change in one transaction, and prints
the buckets, policies and functions it left in place.

**Verify:**

```bash
npm run setup-storage --workspace=@flowhrms/web -- --status
```

It changes nothing. Expect four policies named `…_authenticated_insert`,
each `INSERT` for `{authenticated}` with a check that calls
`private.is_active_member` (proof, media) or `private.is_own_membership`
(documents, receipts); and two functions with `security_definer: true`,
`authenticated_can_execute: true`, `anon_can_execute: false`. The same
from the Supabase SQL editor:

```sql
select policyname, cmd, roles, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;
```

Then, in the app: upload a document (My documents), a receipt (Expenses),
proof on a task, and a logo (Settings → Branding). Each should go through
exactly as before.

The proof that the rule does what this says, without changing the
database, is `apps/web/src/tests/storage-policy-integration.test.ts`: it
creates the functions and policies inside one transaction, tries uploads
as members of demo-co and the sample company, and rolls everything back.
It holds a lock on `storage.objects` for about a second while it runs, so
run it outside busy hours:

```bash
npm run test --workspace=@flowhrms/web -- --project integration src/tests/storage-policy-integration.test.ts
```

**Roll back** (immediate; no deploy needed):

```bash
npm run setup-storage --workspace=@flowhrms/web -- --rollback
```

It restores the previous rule and removes the functions — exactly this,
which can also be pasted into the SQL editor:

```sql
begin;
drop policy if exists "task_proof_authenticated_insert" on storage.objects;
create policy "task_proof_authenticated_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'task-proof');
drop policy if exists "employee_documents_authenticated_insert" on storage.objects;
create policy "employee_documents_authenticated_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'employee-documents');
drop policy if exists "expense_receipts_authenticated_insert" on storage.objects;
create policy "expense_receipts_authenticated_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'expense-receipts');
drop policy if exists "company_media_authenticated_insert" on storage.objects;
create policy "company_media_authenticated_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'company-media');
drop function if exists private.is_own_membership(text, text);
drop function if exists private.is_active_member(text);
drop schema if exists private;  -- leave this line out if anything else lives in private
commit;
```

**If uploads start failing for everyone** ("… didn't upload. Try again."),
run `--status` first, then roll back while you look.

## 8. Before you hand over the URL (30 min)

- [ ] Sign in as the owner on a **real phone**, not a desktop browser
- [ ] Check in from the actual work location — confirm the radius is right
- [ ] Turn the phone to aeroplane mode, check in, restore signal, confirm
      it syncs with the original time
- [ ] Confirm the demo tenant's data is invisible from the customer's login
- [ ] Add it to the home screen (below) and open it from there
- [ ] Take a database backup: `pg_dump "$DIRECT_URL" -Fc -f pre-pilot.dump`

---

## Putting FlowHRMS on the home screen

FlowHRMS installs like an app — a real icon, and no address bar taking up the
top of the screen. There is nothing to publish and no app store involved;
it is a one-time thing each person does on their own phone.

- **Android (Chrome):** ⋮ menu → **Add to Home screen** → **Install**.
- **iPhone (Safari):** Share → **Add to Home Screen**. It must be Safari;
  Chrome on iPhone cannot install it.

Worth telling staff on day one. A phone-first product that lives in a
browser tab gets closed like a browser tab.

**What it does not do yet:** without signal, opening it cold shows the
browser's offline page. Check-ins made *while it is already open* are still
queued and sync later — that part works (see the aeroplane-mode check
above). Closing the gap needs a service worker; it is recorded as D-P9-10
in DECISIONS.md rather than half-built.

---

## Adding the rest of the team

Employees → **Add employee**. Name, mobile number and role are the only
required fields. With an email address they get an invitation and set
their own password; the directory then shows **Pending**, **Accepted** or
**Expired**, and you can resend, withdraw or deactivate from their profile.

Two things to know before you start:

- **Without `SUPABASE_SECRET_KEY` (step 3) nobody can sign in.** People are
  still added and their attendance still records — but no sign-in account
  is created, and the invitation page says so plainly. Set the key first.
- **Without SMTP (step 6) no invitation is emailed.** FlowHRMS does not pretend
  otherwise: it shows you a copyable link to send by WhatsApp instead. That
  link is also the answer for staff who have no email address at all.

An invitation lasts 7 days and works once. Resending issues a **new** link
and kills the old one, so a link that leaked cannot be revived by asking
for another.

## Warning B — what you are taking on with real employee data

The moment a real company's staff use this, you are holding their names,
phone numbers, salaries, ID documents and location-at-check-in. Under
India's DPDP Act that makes you a data processor for your customer.

Three things that are genuinely not optional:

1. **A privacy policy and terms**, published at your domain and linked
   from sign-in. It must say what is collected, why, and for how long.
2. **A written agreement with the customer** covering who owns the data
   and what happens to it if they leave.
3. **Retention windows.** FlowHRMS does not delete anything today, and there is
   no self-service export or deletion — see `ACCEPTANCE.md` §G. Decide the
   windows with the customer and write them down, even if the deletion is
   manual at first.

Two further items from `ACCEPTANCE.md` that are still open, so you are not
surprised by them later: **no assistive-technology testing has been done**,
and **the payroll rules have not been reviewed by a qualified
professional**. FlowHRMS makes no compliance claim and computes no statutory
amount — but the customer should hear that from you before their first
payroll, not after.

---

## Rough cost, monthly

| | |
|---|---|
| Vercel Pro | $20 |
| Supabase Pro | $25 |
| Email (Resend free tier) | $0 |
| Domain | ~₹100/mo equivalent |
| **Total** | **~$45/mo** (~₹4,000) |

---

## If something breaks

- **Build failed** — read the log; it is almost always a missing
  environment variable.
- **Build failed with `TurbopackInternalError … globals.css … node process
  exited before we could connect to it`** — Turbopack could not start its
  CSS helper process on the build machine (29 Sept 2026, Hostinger). The
  production build therefore uses webpack (`next build --webpack` in
  package.json), which processes CSS without that helper; `next dev` keeps
  Turbopack. Do not remove `--webpack` unless the host is known to allow it.
- **App loads but every screen is empty** — `DATABASE_URL` is wrong, or
  RLS was applied to a new table. `npx tsx scripts/setup-rls.ts --status`.
- **Pages work but every query 500s** — the database is unreachable. Check
  the runtime log for the Prisma error; the host it names tells you which
  of the three mistakes in step 2 you made.
- **`Can't reach database server at 'base'`** — the connection string has
  a line break in it. Re-paste as one line.
- **`Tenant or user not found`** — wrong pooler region, or the username is
  `postgres` instead of `postgres.<project-ref>`.
- **"Too many connections"** — switch `DATABASE_URL` to the transaction
  pooler (6543); you are opening connections faster than session mode
  releases them.
- **Everything 503s for a few minutes after a deploy** — the app restarts
  while it settles. It has recovered on its own every time so far; check
  the runtime log for a repeating startup banner before assuming worse.

Verify the database independently of the app at any time:

```bash
npx tsx scripts/verify-production.ts check
```

It reports connectivity, tenant isolation and RLS coverage, and never
prints a credential.
- **Password reset email never arrives** — step 6 was skipped.
- **Reset link 404s** — the redirect allow-list in step 5 is missing.

`OPERATIONS.md` has the incident procedure, backup/restore and the offline
queue's support queries.
