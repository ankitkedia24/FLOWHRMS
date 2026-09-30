# FlowHRMS — by Flowacord

**FlowHRMS** is Flowacord’s HRMS product — *Align. Accelerate. Grow.*

Mobile-first, multi-tenant SaaS for practical workforce operations:
attendance, leave, payroll inputs, tasks, daily reporting and
tenant-controlled modules. Built for Indian SMEs.

**Status: V1 scope complete, plus multi-location.** Foundation and design
system; attendance, leave, tasks with proof, notifications and dashboards;
payroll, configuration, roles and reporting; employee records and
documents; public marketing pages; multiple work locations.

**Before a real pilot**, read [ACCEPTANCE.md](ACCEPTANCE.md) — it records
honestly what is and is not verified. Accessibility testing, data
retention, and the offline queue are the open items.

**On payroll:** FlowHRMS contains **no statutory formulas**. It does not
calculate PF, ESI, professional tax or TDS. A company defines its own
salary components with the figures its accountant supplies; FlowHRMS turns
approved attendance and leave into a payslip whose every line shows how it
was reached. Approval requires an explicit accountant acknowledgement.
**FlowHRMS does not certify statutory compliance** — a qualified local
professional must review the rules before real salary processing
(ROADMAP.md decision gates).

## Source of truth

Product behaviour and design are defined by the approved documents — code
follows them, never the other way round:

| Location | Contents |
|---|---|
| `docs/FlowHRMS-Pack-01-v0.1/` | Product Bible, Constitution, Vision, Modules, Feature Flags, Architecture, Roles, Roadmap |
| `docs/FlowHRMS-Design-Handoff-v1/` | Brand, design tokens, components, screen designs, user flows, accessibility, copy deck |

Start with `docs/FlowHRMS-Design-Handoff-v1/08-claude-code-handoff/README-FOR-CLAUDE-CODE.md`.
When product behaviour, a wireframe and code disagree, the latest approved
document wins. Material changes are logged in `DECISIONS.md`.

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS v4 · Prisma 7 +
PostgreSQL (Supabase) · Supabase Auth · Zod · React Hook Form · Lucide
icons · Vitest. A modular monolith — see `ARCHITECTURE.md`.

## Quick start

```bash
npm install
npm run tokens      # regenerate src/styles/tokens.css from design/tokens/
npm run dev         # http://localhost:3000
```

Full setup — environment variables, database migration, seed data and the
dev preview session — is in `SETUP.md`.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `start` | Production build / serve |
| `npm run lint` / `typecheck` | ESLint / TypeScript |
| `npm run test` | Vitest unit tests (flags, catalog, tokens, status) |
| `npm run tokens` | Regenerate CSS variables from the token JSONs |
| `npm run db:generate` | Generate the Prisma client |
| `npm run db:migrate` | Apply migrations (needs `DIRECT_URL`) |
| `npm run db:seed` | Seed catalog + fictional demo tenant |
| `npm run create-tenant -- --name … --owner-email … --owner-name …` | Create a **real customer company** and get the owner's invitation link. Same code path as `/platform` → Add a company |
| `npx tsx scripts/grant-platform-admin.ts --email … [--revoke\|--list]` | Grant the cross-company operator area at `/platform`. Not grantable from inside the product |
| `npm run delete-tenant -- --slug … --confirm …` | Remove a company and everything in it. Dry run without `--confirm` |
| `npx tsx scripts/setup-rls.ts [--status\|--rollback]` | Row Level Security on every tenant table |
| `npx tsx scripts/provision-user.ts <email> [ROLE]` | Give a login a role in the demo tenant (dev) |
| `npx tsx scripts/demo-data.ts [--clear]` | Create/remove placeholder activity for review (dev) |
| `npx tsx scripts/demo-payroll.ts [--clear]` | Placeholder salary components, structures and attendance (dev) |
| `npm run setup-storage [-- --status\|--rollback]` (in `apps/web`) | The four private storage buckets and who may upload where (DEPLOY.md §7f) |
| `npx tsx scripts/smoke-phase2.ts` | Exercise the daily loop against the database (dev) |
| `npx tsx scripts/smoke-phase3.ts` | Exercise the payroll cycle against the database (dev) |

Run every command from `create-tenant` down inside **`apps/web`** (`cd apps/web`): the scripts live
there and read `apps/web/.env.local`. From the repo root, the npm ones also work as
`npm run <name> --workspace=@flowhrms/web -- <flags>`. Scripts that reuse the app's server code
(`create-tenant`, `delete-tenant`, `sample-data`, `reissue-invite`, `publish-notices`) must go
through npm, never `npx tsx` — see `apps/web/scripts/tsconfig.json`.

## Documentation map

| File | Contents |
|---|---|
| `SETUP.md` | Local setup, env vars, database, seed |
| `ARCHITECTURE.md` | Modular-monolith boundaries, auth flow, flag evaluation, audit |
| `DESIGN-SYSTEM-MAPPING.md` | How design files map to code (tokens → CSS → Tailwind → components) |
| `SECURITY-NOTES.md` | Tenant isolation, authorization layers, dev preview session, key handling |
| `DECISIONS.md` | Decision log (append-only) |
| `ACCEPTANCE.md` | Acceptance checklist A–K with the honest result |
| `OPERATIONS.md` | Backups, RLS, incidents, secrets, known gaps |
| `PILOT.md` | Notes to hand to the first customer |
