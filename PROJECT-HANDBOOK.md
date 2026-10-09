# FlowHRMS — Project Handbook

> **READ THIS WHOLE FILE BEFORE CHANGING ANYTHING.**
> Four duties for every person, computer and AI session:
> 1. **Read** this file at the start of every session.
> 2. **Update** it in the same commit as every change (§10 change log line at minimum).
> 3. **Add what you learned** (§7 gotchas, §11 your machine's section).
> 4. **Pull before you start, push when you finish** (§9).
>
> Last full rewrite: 09-10-2026, Ankit's Windows PC (Claude Code). Dates: `DD-MM-YYYY`. Times: IST (UTC+5:30).
> Money: ₹, whole rupees in payroll. Locale: `en-IN`.

## 1. What the project is

FlowHRMS by Flowacord is a multi-tenant HR SaaS for Indian small and medium businesses: attendance with
location at check-in, leave, tasks with photo proof, payroll inputs, expenses, field visits, performance
points, and DPDP-compliant consent. It is live at https://hrms.flowacord.com on self-serve 30-day trials.
Users: **Flowacord** (platform admins who run the service), **company owners/admins/HR/managers** (the
admin area), and their **employees** (a phone-first area). Formerly "Sudarshan Task Force" (STF); renamed
14-09-2026.

```
 Employee phone / admin desktop (browser, installable PWA)
        │ HTTPS
        ▼
 hrms.flowacord.com — Hostinger Web App, Node 22, Next.js 16 standalone server
   proxy.ts (is anyone signed in?) → route group layouts → requireSession / checkAccess
   → Server Actions in apps/web/src/lib/**/actions.ts → Prisma (lib/db.ts) → audit_events
        │                │                 │                  │
        ▼                ▼                 ▼                  ▼
 Supabase FLOWACORD   SMTP mailbox     Google Maps JS +    Razorpay checkout +
 Postgres 17 + Auth   (invites, codes, Routes API          /api/razorpay/webhook
 + Storage (4 private crash alerts)    (field visits)      (keys not set yet)
 buckets)
 Expo app (apps/mobile) ──► /api/v1/* — exists only on Rishabh's branch, not live
 GitHub ankitkedia24/FLOWHRMS main ──push──► Hostinger auto-build (~5–6 min) ──► live
 Office PC ──npm run backup──► G:\My Drive\FlowHRMS-Backups (encrypted; not started yet)
```

## 2. Owner rules — ALWAYS follow

The owner is Ankit (GitHub `ankitkedia24`). Rishabh (`RishabhPandeyRP`) develops in the same repo.

**Process**
1. Pull, resolve, then push. Owner, 29-09-2026: *"Always pull from repo, check for conflicts, resolve everything then only push."* Reason: Rishabh pushes to the same repo, and a push was rejected on 29-09.
2. Work on a branch; main stays untouched. Owner: *"do the development work on a different branch always so that main is not disturbed."* Name branches `<area>/<short-name>`, e.g. `platform/support-login`.
3. **Nothing reaches main without the owner's explicit OK for that piece of work** (owner, 09-10-2026). Merging to main deploys to the live site.
4. Plan before any new feature. Owner: *"if you develop any new feature then ask me before developing, start with you whole fix plan first."* Every phase starts only when the owner says so (`docs/md/IMPLEMENTATION_PHASES.md`).
5. Keep both mains identical: push main to `ankit` AND `origin`. Never force-push main, never rebase shared history.
6. After every change, report: the local path, the branch and commit id, and GitHub links for both repos. Owner, 07-10-2026: *"always give me the link of the repo where you update, local and GitHub both."*
7. Keep Rishabh's monorepo layout (`apps/web`, `apps/mobile`, `packages/*`). Don't merge or rewrite his branches without asking.
8. Docs before code (`docs/md/PRODUCT-CONSTITUTION.md` §8). Record material decisions in `DECISIONS.md`, which is append-only.

**Safety**
9. Secrets never leave their files. Owner: *"Do not expose or print database credentials anywhere in logs, commits, screenshots, or documentation."* *"Don't send me the password or connection string."* Name a variable, never its value.
10. `apps/web/.env.local` points at the **LIVE production database**. Diagnostics against it are read-only. Integration tests write there and must clean up. Never run `sample-data`, `create-tenant`, `delete-tenant` or `publish-notices` "just to test".
11. Test and demo **only** in `demo-co` ("Demo Trading Co. (placeholder)") and `sunrise-traders-sample` ("Sunrise Traders (sample)"). Every other company is a real customer. As of 30-09-2026: GROUP G, FX & Float, Amit Book Depot (×2), Kamal sattu. The owner said there is more to protect; list still to come (§5).
12. Never sign in, type a password, accept Terms/consent, or confirm a legal attestation on the owner's behalf. Ask the owner to do it.
13. Brand: *"DO NOT alter or overwrite the original brand asset folder"* (`C:\Users\ankit\OneDrive\Desktop\Flowacord Brandassets\Flowacord`) and *"Do NOT redesign, recreate, approximate, or invent the Flowacord logo or brand identity."*
14. *"no do not add as collaborator"*: don't add GitHub collaborators or change repo access.
15. Suspending a company or ending a trial always needs the code emailed to info@flowacord.com. Owner: *"not even me"* (D-PL-01).
16. Flowacord support changes are always recorded as "Flowacord support", never as a company's own person. A real company opens for support only after its owner accepts the v3 Terms (D-PL-03).
17. Legal text: any wording change is a new `version`, reviewed by the lawyer, published with the bridge (§7).
18. Never delete `audit_events` or `consent_records`. Never let a test issue a real invoice number.
19. Location only at check-in, check-out and field-visit taps, never in the background. That is the published promise until the owner decides otherwise.
20. No statutory payroll formulas (PF/ESI/PT/TDS); FlowHRMS does not certify compliance (D-P3-01).
21. The Supabase database password gets rotated at the end of the project (owner's plan), not before.

**Style**
22. Plain English in the UI and in reports, no jargon. Indian formats: ₹, `en-IN`, IST.
23. Commit messages: one plain sentence saying what changes for people ("Let …", "Stop …"), with the reason in the body. Merges are titled "Merge: …". AI sessions add their tool's `Co-Authored-By` trailer.

**Business conventions**
- Plans: CORE ₹1,499/month (25 employees included, +₹49 each extra), PRO ₹2,999 (50, +₹59), BUSINESS ₹6,999 (100, +₹49). A year costs 10 months (D-PR-01).
- Modules aren't tiered yet. Trials and every plan get the Starter set: Employees, Attendance, Leave, Daily reporting, Notifications (D-PR-02). Paying never removes a module (D-PR-03).
- Trial: 30 days; on day 31 the company pauses and its data is kept. Paid plans get 7 days' grace after `paidUntil`, then pause.
- Billing: 18% GST tax invoice, number format `FH/<fy>/<5 digits>`, Razorpay, no auto-renew.
- Only the Owner may decide or settle their own approval request (leave, attendance, expense claim, task proof).
- Contacts: support help@flowacord.com, 8908888880. Codes and crash alerts go to info@flowacord.com.

## 3. Where everything lives

| Repo | Local path | GitHub | Role |
|---|---|---|---|
| **FlowHRMS** (main) | `C:\Users\ankit\OneDrive\Desktop\FlowHRMS` | https://github.com/ankitkedia24/FLOWHRMS (remote `ankit`) and https://github.com/FLOWACORD1/FLOWHRMS (remote `origin`) | Everything: web, mobile, database schema, docs |
| SudarshanTaskForce (archive) | `C:\Users\ankit\OneDrive\Desktop\SudarshanTaskForce` | https://github.com/INETIAFLOW/STF, https://github.com/ankitkedia24/SudarshanTaskForce | Pre-rebrand STF, frozen at `5eb82c1`. Never work here. |

- **Push rules:** push to `ankit` and `origin` only. `hostinger` and `inetiaflow` in FlowHRMS are archive remotes; never push to them. Tags `pre-flowhrms-rebrand` (`5eb82c1`) and `pre-flowhrms-rebrand-deploy` are safety points.
- **Hostinger deploys from `ankit` main** (ankitkedia24/FLOWHRMS). The FLOWACORD1 repo is a mirror.
- **Live URLs:** https://hrms.flowacord.com · health `/api/health` (`{"status":"ok"}`) · operator area `/platform` · health/backups/crash log `/platform/system` · notices `/platform/notices` · Razorpay webhook `/api/razorpay/webhook`.

**How a deploy happens**
1. Owner OKs the merge → merge the branch into main (`--no-ff`) → push main to `ankit` and `origin`.
2. If the change has a migration or new notice text, apply them first (§6.7).
3. Hostinger (root `./`, output `.next`, Node 22) runs `npm install` (postinstall: `prisma generate`), then `npm run build` = `prisma generate` + `next build --webpack` in `apps/web` + `scripts/mirror-web-build.mjs`. It runs `.next/standalone/server.js`, never `npm start`.
4. Check it finished: the build id in `curl -s https://hrms.flowacord.com/sign-in` (the `"b":"<id>"` value) changes, `/api/health` says ok, and the behaviour you changed works on the live site. Use plain URLs, not cache-busters.
5. Failed? Read the last lines of the build log in hPanel (Websites → hrms.flowacord.com → Deployments). Only the owner can sign in there. A "Redeploy" commit or the hPanel **Redeploy** button retriggers a build.

**Database** — Supabase project **FLOWACORD**, ref `qmhvwnepdxrfreivevle` (verified from the `.env.local` host), ap-south-1, PostgreSQL 17.6, **PRODUCTION**.
- The app connects via the transaction pooler `aws-0-ap-south-1.pooler.supabase.com:6543` (`DATABASE_URL`). The CLI and scripts use the session pooler `:5432` (`DIRECT_URL`). Never use the direct host; Hostinger is IPv4-only.
- Migrations: `prisma/migrations` (28 so far, additive). Apply with root `npm run db:migrate` BEFORE pushing code that needs them, then `cd apps/web && npx tsx scripts/setup-rls.ts` (RLS on every table, no permissive policy).
- Storage buckets, all private: `task-proof`, `employee-documents`, `expense-receipts`, `company-media`. Set up with `npm run setup-storage --workspace=@flowhrms/web`.

**Machines**

| Machine | Role | Quirks |
|---|---|---|
| Ankit's Windows 11 PC | Owner's machine, Claude Code sessions, backups | Repo is in OneDrive. Node 22.22.3, npm 10.9.8, Git 2.51. PostgreSQL 17 installed (used by backup rehearsal). Docker installed but not running. `gh` CLI not installed. Google Drive at `G:\My Drive`. ~12 GB disk free. Timezone IST. |
| Rishabh's computer | Mobile app development | Details unknown (unverified). He should add his own §11 section. |
| Hostinger build server | Builds and serves production | Linux, Node 22, fresh clone each build. Downloads Google Fonts at build time (§7). |

**Key IDs**
- Tenants: `demo-co` (placeholder test company); `sunrise-traders-sample`, id `14cb54d0-1e6f-40cd-b6aa-e6bc7ff056f7` (test company); `group-g`, id `adc8ab92-c152-4d7a-bb7d-65360946e94d` (real customer).
- Platform admin account: info@flowacord.com ("Flowacord Admin"), Owner of the sample company. Grant platform admin with `apps/web/scripts/grant-platform-admin.ts`; there is no UI for it.
- Google Cloud project `flowhrms` (Maps keys). Mobile bundle id `com.flowhrms.app`.

## 4. Project structure

```
FlowHRMS/                     npm-workspaces monorepo (apps/*, packages/*)
├─ PROJECT-HANDBOOK.md        this file
├─ package.json               root scripts: build, dev, dev:mobile, db:migrate, db:seed, test, typecheck
├─ prisma/                    schema.prisma (65 models, 43 enums), migrations/, seed.ts (catalog + demo-co)
├─ prisma.config.ts           Prisma CLI: env from apps/web/.env.local, DIRECT_URL, client → apps/web/src/generated
├─ scripts/mirror-web-build.mjs  copies the web build to root .next + .next/standalone/server.js for Hostinger
├─ DECISIONS.md               append-only decision log (D-P1-01 … D-PL-03)
├─ DEPLOY.md / OPERATIONS.md  go-live runbook (§3b Hostinger) / running it (backups, support, suspension)
├─ docs/md/                   living specs (modules, roles, pricing, DPDP, phases); docs/STF-* = historical
├─ packages/types, packages/validation   shared TS types and zod schemas (used by mobile)
├─ apps/mobile/               Expo SDK 57 + expo-router app (scaffold on main; real work on feature/Mobile_App)
└─ apps/web/                  the live Next.js 16 app (@flowhrms/web)
   ├─ .env.local              LIVE secrets + production DB (git-ignored; never print)
   ├─ next.config.ts          output standalone, outputFileTracingRoot = repo root, no-cache headers on HTML
   ├─ scripts/                npm scripts: sample-data, create-tenant, delete-tenant, reissue-invite,
   │                          publish-notices, setup-storage, backup, backup-rehearse, backup-open; setup-rls.ts
   └─ src/
      ├─ proxy.ts             Next 16 "proxy" (was middleware): session refresh, PUBLIC_PATHS
      ├─ instrumentation.ts   production crash capture → lib/platform/errors.ts
      ├─ app/                 (home) (marketing) (legal) (auth) (employee) (admin)/admin (platform)/platform,
      │                       consent, trial-ended, subscription, api/health, api/razorpay/webhook
      ├─ lib/                 domain logic + server actions: authz, auth, platform, billing, consent, payroll,
      │                       attendance, leave, tasks, expenses, field-visits, performance, actions, offline…
      ├─ components/          UI by domain; components/ui = design-system primitives
      └─ tests/               76 vitest files; *-integration.test.ts hit the LIVE DB
```

| Task | Command (run in `C:\Users\ankit\OneDrive\Desktop\FlowHRMS`) |
|---|---|
| Dev server (web) | `npm run dev` (port 3000). Claude's preview config "flowhrms" uses port 3100; it lives, uncommitted, in `SudarshanTaskForce/.claude/launch.json`. |
| Dev server (mobile) | `npm run dev:mobile` (Expo); `npm run dev:mobile:tunnel` for a phone on another network |
| Typecheck | `npm run typecheck --workspace=@flowhrms/web` (mobile: `--workspace=@flowhrms/mobile`) |
| Tests | `npm test --workspace=@flowhrms/web`: unit + integration (integration runs one file at a time, against the LIVE DB) |
| Lint | `cd apps/web && npx eslint src scripts` (2 known React-compiler notices are expected) |
| Production build | `npm run build` at the root. Stop the dev server and delete `apps/web/.next/dev` first. |
| Prisma client | `npx prisma generate` at the root; restart the dev server afterwards |

**Does NOT work:** `npx tsx` on scripts that import server code (use the npm scripts, run in `apps/web` or with `--workspace=@flowhrms/web`). `npm run tokens` from the root (web workspace only). The dev fixture session never writes audit rows or shows action tiles.

## 5. Current state (09-10-2026)

**Works today (live):**
- Self-serve 30-day trial with DPDP consent. Invitations are held until the owner confirms their email.
- Attendance (location, shifts, branches), leave, tasks with proof, daily report, payroll runs (no statutory formulas).
- Expenses E0–E2, field visits P1–P5 (module off for every company as of 29-09-2026), performance and leaderboards, ID cards, branding.
- CORE/PRO/BUSINESS pricing; `/subscription` checkout (inactive until the Razorpay keys are set).
- Hardening batches 1–7: rank rules, team scope, file signing, payroll locks.
- Platform tools:
  - lockout codes;
  - crash emails, `/api/health`, `/platform/system`;
  - support login, live since 01-10-2026 with the v3 Terms, lawyer-approved;
  - all notices in force are marked legally reviewed.
- Last full check (01-10-2026): 1188 tests pass, build ok.

**Next, in priority order (owner-confirmed 09-10-2026):**
1. Rishabh's `feature/Mobile_App` branch. As of 06-10-2026 it is 6 commits ahead of main with about 20 `/api/v1/*` routes, and it edits `proxy.ts` and `scripts/mirror-web-build.mjs`, which the deploy depends on. Review it, test it, and merge only with the owner's OK.
2. Owner setup:
   - `BACKUP_PASSPHRASE` in `.env.local`, then the first `npm run backup` and `backup-rehearse`;
   - an UptimeRobot monitor on `/api/health`;
   - Razorpay keys, seller GSTIN, and the CA confirming SAC 997331.
3. Decide which modules go in CORE/PRO/BUSINESS (`docs/md/PLAN_ENTITLEMENT_MATRIX.md`).
4. Phase 2 feature parity. It needs a background job scheduler, and a decision on statutory payroll (reverses D-P3-01).

**Parked / blocked**
- Phase 1B billing engine: waits on owner decisions on proration and overrides.
- Phase 3 field workforce: waits on `docs/md/mobile/OPEN_DECISIONS.md` §1–5 and legal review.
- Sign-up OTP: paused by the owner.
- Hindi notice texts: waiting.
- Expenses E3/E4: not built.
- GROUP G support: waits until its owner accepts the v3 Terms.
- Stale docs to fix (§7, 09-10-2026 audit): README/SETUP (pre-monorepo paths), DEPLOY §3/§4 (Vercel), SECURITY-NOTES "Deferred" list, mobile docs that still plan Capacitor.

## 6. How things work

1. **Request path.** `proxy.ts` refreshes the Supabase session (public paths skip it). Layouts and pages call `requireSession()` / `checkAccess()` in `lib/authz/guard.ts`. `getAppSession()` in `lib/auth/session.ts` resolves user → ACTIVE membership → tenant → role permissions. Mutations are Server Actions in `lib/<domain>/actions.ts` and write `audit_events` via `lib/audit.ts`.
2. **Access model.** `lib/catalog.ts` holds the modules, features, permissions and role templates (Owner, Super Admin, Admin, HR, Manager, Team Leader, Employee, Viewer). `lib/authz/entitlements.ts` and `flags.ts` give each company its modules; unbuilt features never count as on. `lib/authz/scope.ts` limits Manager, Team Leader and Viewer to their team. `lib/authz/approvals.ts` lets only the Owner decide their own requests.
3. **Consent (DPDP).** Texts live in `lib/consent/documents.ts` (versioned) → `npm run publish-notices` → `consent_notices`. `requireSession` sends anyone without current consent to `/consent`. Records are hash-chained (`chain.ts`, `record.ts`) and can't be deleted.
4. **Trial and billing.** `/start` → `lib/signup/actions.ts` → `provisionTenant` (`lib/platform/provision.ts`). Access state comes from `accessState()` in `lib/billing/pricing.ts`, and paused companies go to `/trial-ended`. Paying: `/subscription` → `lib/billing/actions.ts` → Razorpay → confirm or webhook → `lib/billing/activate.ts` (invoice + modules).
5. **Approvals queue.** `lib/actions/service.ts` raises a request, `lib/actions/audience.ts` picks the recipients, and `ActionQueueProvider.tsx` polls them into tiles. Same action whether decided from the tile or the screen.
6. **Offline.** `lib/offline/{queue,store,sync}.ts`: punches, field taps, leave and task proof are queued in the browser with their capture time. Transport failures retry up to 5 times; server refusals stop at once. Admin work is never queued.
7. **Migrations and notices go out first.** Order: `npm run db:migrate` → `setup-rls.ts` → `publish-notices` → push. Publishing retires old notice versions, so put the old versions back to PUBLISHED until the new build is live (`docs/md/SUPPORT-ACCESS.md` → Publishing).
8. **Platform controls.**
   - Lockout codes: `lib/platform/lockout-code.ts`.
   - Crash capture: `instrumentation.ts` → `lib/platform/errors.ts`.
   - Support login: the `fh_support` cookie → `lib/auth/support.ts`. The support person works as a hidden `SUPPORT` member, and `lib/db.ts` filters that member out of every membership read.
   - Backups: `apps/web/scripts/backup*.ts`.
9. **Field visits.** Four taps (`lib/field-visits/actions.ts`). Road distance is computed after the response with `after()` in `legs.ts` via the Google Routes API (`GOOGLE_MAPS_SERVER_KEY`). Monthly travel claims go into Expenses and are paid through payroll.
10. **No background jobs exist.** No cron and no queue. Anything scheduled needs Phase 2's job runner.

## 7. Lessons learned / gotchas

- 18-08-2026: Behind Hostinger's proxy `request.url` is `https://0.0.0.0:3000`. Redirect with a plain `Response` and a RELATIVE `Location` (see `app/auth/sign-out/route.ts`).
- 23-08-2026: Verify production with plain URLs. Cache-busters hit origin and hide stale CDN copies. HTML must stay `must-revalidate`.
- 23-08-2026: A page for a disabled module returns HTTP 200 (the redirect travels inside the RSC stream). Check the body, not the status.
- 14-09-2026: `getAppSession()` needs an ACTIVE membership, even for platform admins.
- 29-09-2026: The monorepo move broke Hostinger ("No output directory", then "no standalone server"). Fixed with `output: "standalone"` + `outputFileTracingRoot` + `mirror-web-build.mjs`. A local build passing ≠ Hostinger passing.
- 29-09-2026: Publishing notices retires the old versions, and the live build then refuses sign-ups until it redeploys. Keep the old versions PUBLISHED until the new build is live.
- 29-09-2026: In `pg` scripts on this PC, Prisma `DateTime` prints 5h30m early (UTC read as IST). Set `types.setTypeParser(1114, …)`.
- 30-09-2026: Git worktrees inside the repo made the local build take 23 minutes. Remove them afterwards.
- 30-09-2026: `apps/web/.next/dev/types/validator.ts` half-written by OneDrive breaks the build. Stop the dev server and delete `.next/dev`.
- 30-09-2026: The scripts' `server-only` shim must point at the ROOT `node_modules` (`../../../node_modules/next/...`). Mobile's expo-router installs a real `server-only` that throws.
- 30-09-2026: Windows: a spawned `pg_ctl start` keeps the parent's pipes open. Use `stdio: "ignore"` and the `exit` event.
- 30-09-2026: Backup rehearsal: don't drop the fresh database's `public` schema, because the dump doesn't recreate it.
- 30-09-2026: Claude Code's Bash tool collapses `\\` and breaks `node -e` on apostrophes. Write scripts to files with the editor instead.
- 30-09-2026: Claude Code's safety check blocked a covert, unrecorded support login. The open variant was built instead.
- 01-10-2026: A Hostinger build failed in `next/font` with "Cannot read properties of null (reading '1')": Google gave the build server a font URL with no extension. Redeploy fixed it. Local builds hide this because fonts are cached in `.next/cache`.
- 01-10-2026: A consent record can be `GRANTED` or `UPDATED` (optional choices changed); both count as acceptance. Only `WITHDRAWN` doesn't.
- 01-10-2026: The built-in browser pane auto-cancels `window.confirm` (e.g. the "Mark reviewed" button). A background tab stays on "Loading" until it is brought to the front.
- Ongoing: deploys take ~5–6 min, sometimes much longer. Don't call a slow build failed before checking hPanel. Consecutive pushes may produce one build.
- Ongoing: `NEXT_PUBLIC_*` values are baked in at build time; changing them needs a rebuild. Server-only env changes need a restart or redeploy.

## 8. Domain knowledge (read before redoing research)

| Topic | Where |
|---|---|
| Product principles, vision, modules, roles | `docs/md/PRODUCT-CONSTITUTION.md`, `PRODUCT-BIBLE.md`, `MODULES.md`, `USER-ROLES.md` (amendments 1–6) |
| Plan, phases, gap audit, pricing | `docs/md/IMPLEMENTATION_PHASES.md`, `MODULE_GAP_AUDIT.md`, `PLAN_ENTITLEMENT_MATRIX.md`, `PRICING_MIGRATION_PLAN.md`. The external pricing brief is not in the repo. |
| DPDP Act 2023 / Rules 2025 | `docs/md/DPDP-COMPLIANCE.md`, `LEGAL-REVIEW-SUPPORT-TERMS.md`, `SUPPORT-ACCESS.md` |
| Module specs | `docs/md/EXPENSES-MODULE.md`, `FIELD-VISITS-MODULE.md`, `PERFORMANCE-MODULE.md` |
| Payroll stance | D-P3-01..07 in `DECISIONS.md`, `README.md`, `PILOT.md` (no statutory research doc exists) |
| Mobile | `docs/MONOREPO-SPEC.md` (Expo, current); `docs/md/mobile/*` (Capacitor plans and 12 open decisions) |
| Brand | `docs/md/BRAND-GUIDELINES.md`; asset folder in §2 rule 13 |

## 9. How to work on this project (every session)

1. `cd C:\Users\ankit\OneDrive\Desktop\FlowHRMS`, then `git fetch ankit origin`. If either main moved, merge it into local main first.
2. Read this file. Say which repo and branch you are working in.
3. New feature? Show the plan and wait for the owner's go-ahead (rule 4).
4. `git switch -c <area>/<name>` from the updated main.
5. Change the code. Typecheck, unit tests, the integration tests you touched, lint, and root `npm run build`.
6. Verify for real: the preview (only demo-co or the sample company) or the database read-only. Clean up any test rows.
7. Commit, with the handbook updated in the same commit (§10 line, plus §5/§7/§11 if they changed). There is no separate CHANGELOG file; §10 is it.
8. Fetch again, merge main into your branch, re-test, and push the branch to `ankit` and `origin`.
9. Merge to main **only with the owner's OK**, then push main to both remotes and watch the deploy (§3).
10. Report to the owner: the local path, the branch, the commit id, GitHub links for both repos, what you tested, and what is pending.

## 10. Change log

Format: `DD-MM-YYYY · repo · commit · what & why (machine)`, newest first. A commit can't contain its own id, so write `(this)`. The next session replaces it with the real short id.

- 09-10-2026 · FlowHRMS · (this) · Add PROJECT-HANDBOOK.md and CLAUDE/AGENTS pointers, so every session starts from the same facts (Ankit's PC)
- 01-10-2026 · FlowHRMS · c804bf8 · Publish lawyer-approved v3 Terms; support may open real companies once their owner accepts (Ankit's PC)
- 30-09-2026 · FlowHRMS · f96d7a0 · Flowacord support login, changes recorded as "Flowacord support" (Ankit's PC)
- 30-09-2026 · FlowHRMS · 4b289f1 · Crash emails, `/api/health`, encrypted backups + restore rehearsal, `/platform/system` (Ankit's PC)
- 30-09-2026 · FlowHRMS · 63c6224 · Unbuilt features never count as on; dead code; stale ops notes (Ankit's PC)
- 30-09-2026 · FlowHRMS · 02b7e19 · Suspend / end trial need a code emailed to info@ (Ankit's PC)
- 30-09-2026 · FlowHRMS · 26de26d · Scripts start again in the monorepo (`server-only` shim path) (Ankit's PC)
- 30-09-2026 · FlowHRMS · db53921 · Only the Owner decides their own expense claim (Ankit's PC)
- 30-09-2026 · FlowHRMS · 6d3f969 · Hardening batch 7: task proof, expense scope, honest notifications, storage upload rule (Ankit's PC)
- 30-09-2026 · FlowHRMS · f8385e0 · Hardening batches 2–6: approvals, files, payroll locks, dead ends, team scope (Ankit's PC)
- 29-09-2026 · FlowHRMS · 6782d66 · Publish the standalone server Hostinger runs (deploy fix after the monorepo) (Ankit's PC)
- 29-09-2026 · FlowHRMS · 72c155f · Take Rishabh's monorepo restructure (`5a5e9d9`: web → apps/web, Expo → apps/mobile) (Ankit's PC + Rishabh)
- 29-09-2026 · FlowHRMS · 0248acc · Hardening batch 1: nobody changes those above them, or themselves (Ankit's PC)
- 29-09-2026 · FlowHRMS · 57a81ea · Price as CORE / PRO / BUSINESS (Ankit's PC)
- 29-09-2026 · FlowHRMS · aa889c2 · Phase 0 audit of every module against the pricing brief (Ankit's PC)
- 29-09-2026 · FlowHRMS · 3fd3a6a · Send the invitations held until the owner confirmed their email (Ankit's PC)
- 29-09-2026 · FlowHRMS · 8bdbd58 · Build for production with webpack, not Turbopack (Ankit's PC)
- 29-09-2026 · FlowHRMS · 4e0ab76…63abf0f · Field visits P1–P5, module switched off (Ankit's PC)
- 28-09-2026 · FlowHRMS · 9f7c137 · Designations, inline adds, map, photo, logo, ID cards (Ankit's PC)
- 27-09-2026 · FlowHRMS · b236ea9 · Plans and payment in the app (Razorpay, GST invoice) (Ankit's PC)
- 27-09-2026 · FlowHRMS · bdd04c1 · Self-serve free trial with DPDP consent recorded as proof (Ankit's PC)
- 14-09-2026 · FlowHRMS · 42474c2 · Become FlowHRMS by Flowacord (rebrand from STF) (Ankit's PC)
- 07-08-2026 → 08-09-2026 · STF / FlowHRMS · 785e982…5eb82c1 · Phase 1 foundation through V1: attendance, leave, tasks, payroll inputs, offline queue, onboarding and action queue, performance, expenses E1–E2. 162 commits on main in total (Ankit's PC)

## 11. Memories from each computer / person

### Ankit's Windows 11 PC (Claude Code; 07-08-2026 → 09-10-2026)
- Claude Code here starts in `Desktop\SudarshanTaskForce` (the archive). Always `cd` to `Desktop\FlowHRMS`. Its memory notes live in `~/.claude/projects/C--Users-ankit-OneDrive-Desktop-SudarshanTaskForce/memory/`, with older ones under `...-FlowHRMS/memory/`.
- Owner preferences seen: short plain-language reports; links to everything; asks "done?" and expects verified results; approves plans via short answers; decides legal and pricing matters personally.
- The built-in browser pane is often signed in to hrms.flowacord.com as Flowacord Admin. hPanel sign-in does not persist there. Look, don't save, on real companies.
- Dev fixture: `FLOWHRMS_DEV_FAKE_SESSION=OWNER` in `apps/web/.env.local` (add one line, remove it after). It resolves to demo-co, but the fixture isn't a platform admin, so `/platform` pages can't be previewed with it.
- Results: 01-10-2026 — 1188 tests and the build pass. Support login tested end to end in the sample company (blood group A+ → O+ → back to A+).
- Incidents:
  - 29-09-2026: the monorepo deploy broke and sign-up was blocked by the notice bridge (both fixed).
  - 01-10-2026: the font build flake (fixed by Redeploy).
- Not done yet: no real backup exists (passphrase not set; Drive folder not created). No uptime monitor.

### Rishabh's computer
- (no entries yet — Rishabh adds his machine, OS, Node version and quirks here)

### (next computer — add a dated section here)
