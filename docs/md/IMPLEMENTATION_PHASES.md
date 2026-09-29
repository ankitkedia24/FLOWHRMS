# FlowHRMS — Implementation Phases

Version: 1.0 | Date: 29 September 2026 | Status: Phase 0 complete; Phase 1A (pricing model) done; nothing else started. Every later phase starts only when the owner says so, with a plan shown first.

Companions: `MODULE_GAP_AUDIT.md`, `PLAN_ENTITLEMENT_MATRIX.md`, `PRICING_MIGRATION_PLAN.md`.

Order follows the brief (§15) with one addition: a hardening phase before new modules, because the audit found defects that new work would build on.

| Phase | Name | Status | Risk |
|---|---|---|---|
| 0 | Audit | **Done** (29 Sept 2026) | — |
| 1A | Pricing model: CORE / PRO / BUSINESS | **Done** — step 2 migration after deploy | Low |
| H | Hardening: security and correctness defects | Not started | Medium (payroll) |
| 1B | Billing engine and entitlements | Not started | Medium |
| 2 | CORE / PRO parity | Not started | Medium–High |
| 3 | Field workforce (native, trail, FieldTrack) | Not started | High (privacy, native) |
| 4 | BUSINESS HR suite | Not started | High (size) |
| 5 | AI and enterprise hardening | Not started | Medium |
| 6 | Pricing rollout (tiers live, customer migration) | Not started | Medium (commercial) |

---

## Phase 0 — Audit (done)

Delivered the four documents. Findings in one line each: core HR, attendance, leave and payroll inputs are real and mostly partial; ATS, performance appraisal, assets, surveys, helpdesk, API, SSO, AI and statutory payroll are missing; several switches do nothing; ten security/correctness defects are listed in the audit.

## Phase 1A — Pricing model (done)

CORE/PRO/BUSINESS with base + included + extra employees, annual = 10 months, prices editable in `/platform/plans`; paying never removes modules; new trials and all plans unlock the Starter set until tiered. Details: `PRICING_MIGRATION_PLAN.md`. Remaining step: apply `20260929230000_offer_core_pro_business` once the new build is live.

## Phase H — Hardening (recommended next)

Fix what the audit flagged before building on it. Each item is small and testable.

1. Rank, self and last-owner checks in `saveEmployeeAction` and `deactivateEmployeeAction`.
2. Block role self-escalation in `saveRolePermissionsAction`.
3. Block self-approval of attendance and leave; scope approvals to the reporting line.
4. Tenant-prefixed, validated document paths; confirm document opening works.
5. Payroll: approval rewrites lines atomically with totals; Calculate in one transaction; exclude rejected/pending attendance; no adjustments on approved runs; lock the run in the expense→payroll seam; keep `isStatutory`.
6. Rebuild missed-punch correction (structured time, applied on approval, with UI) or remove it.
7. Hide or delete every dead switch (flags and permissions with no code) and correct marketing claims (overtime, rosters).
8. Record scope for Manager/Team Leader/Viewer as the roles page already promises.
9. Tests for the untested actions touched above.

Risk: payroll changes need care with existing runs; everything else is local.

## Phase 1B — Billing engine and entitlements

- Capability-level entitlements (`expenses.enabled`, `tasks.advanced`, …) and limits (`included_employees`, `fieldtrack_seats`, …) checked server-side; decisions logged.
- A separate platform rollout-flag mechanism (not `tenant_feature_settings`).
- Grandfathered-module record; preview for "apply modules to companies".
- Read-only mode for switched-off modules (keep history visible).
- Upgrade/downgrade with proration or scheduled change; enterprise price override; coupons/partner pricing as overrides; add-on quantities; usage metering hooks; renewal reminders; credit notes.
- Superadmin subscription console: plan, interval, billable employee count, overrides, add-ons, effective dates.
- Needs owner decisions: proration policy, override rules, renewal behaviour.

## Phase 2 — CORE / PRO parity

Close gaps for whatever the owner puts in CORE and PRO. Candidate list from the audit: selfie attendance; shift rosters and rotation; early-exit, overtime, comp-off; attendance locks; leave types, balances, accrual; payslip PDF and email; loans/advances; arrears and variable pay; full & final; statutory identifiers and bank details; bank advice; Tally export; employee lifecycle workflows (confirmation, transfer, resignation, no-dues); letter templates; custom fields; assets; announcements and policy acknowledgement; advanced tasks (recurring, templates, reminders — needs a scheduler); multi-level approvals; email/WhatsApp notification channels (needs a queue).

Prerequisite infrastructure: a server-side job scheduler/queue (reminders, escalation, recurring tasks, scheduled reports, retention purges, retries).

Needs owner decision first: **statutory payroll** — CORE's "PF/ESI/PT/TDS calculations" reverses decision D-P3-01 and needs rule tables per state plus accountant review.

## Phase 3 — Field workforce

Builds on Field visits (live since 29 Sept 2026): native Android/iOS shell (Capacitor, `docs/md/mobile/*`), background location with a foreground service, tracking enrolment per employee and working-hours windows, new optional consent and notice version (the current one promises "never continuously"), retention and purge job, spoofing/impossible-travel flags, task ↔ visit link, customer acknowledgement, FieldTrack add-on seats and billing. Needs owner decisions: `OPEN_DECISIONS.md` §1–§5, FieldTrack price, legal review.

## Phase 4 — BUSINESS HR suite

Multi-company (a group over tenants, one person in several companies), ATS, structured onboarding, performance appraisal (KRA/KPI/OKR/360 — a new module, not PERFORMANCE), engagement surveys, helpdesk, advanced analytics and scheduled reports, SSO, public API with keys and rate limits, outgoing webhooks, advanced audit views.

## Phase 5 — AI and enterprise hardening

Permission-aware AI with audit and human approval, isolation test suite, security review, scale tests, migration tooling, deployment documentation for FlowHRMS Private.

## Phase 6 — Pricing rollout

Tiers decided and entered in `/platform/plans` (bullet points appear on the site automatically), customer migration with snapshot → preview → grandfathering → notice (`PRICING_MIGRATION_PLAN.md` §5), online payment opened (Razorpay live keys, seller GSTIN), monitoring.
