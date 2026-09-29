# FlowHRMS — Pricing Migration Plan

Version: 1.0 | Date: 29 September 2026 | Status: pricing model switched on 29 Sept 2026 (step 1 applied; step 2 after deploy). Module tiering deferred by the owner.

Companions: `PLAN_ENTITLEMENT_MATRIX.md`, `MODULE_GAP_AUDIT.md`, `IMPLEMENTATION_PHASES.md`. Source: *FlowHRMS Pricing, Packaging & Module Implementation Brief*, owner decisions recorded below.

## 1. Decisions (owner, 29 Sept 2026)

| Decision | Value |
|---|---|
| Public plans | Exactly three: **CORE**, **PRO** (Most popular), **BUSINESS**. Keys `core`, `pro`, `business`. |
| Model | Base price covering a number of active employees + a price per employee above that. |
| CORE | ₹1,499/month · 25 included · +₹49/employee/month · ₹14,990/year · +₹490/employee/year |
| PRO | ₹2,999/month · 50 included · +₹59/employee/month · ₹29,990/year · +₹590/employee/year |
| BUSINESS | ₹6,999/month · 100 included · +₹49/employee/month · ₹69,990/year · +₹490/employee/year |
| Annual | Ten months ("Save 2 months") — for the base **and** for each extra employee. |
| Modules per plan | Deferred. Until tiered, all three plans and new trials unlock the **Starter set**: Employees, Attendance, Leave, Daily reporting, Notifications. |
| On payment | A company **keeps every module it already has**; paying only adds (brief §13). |
| What the website shows | Prices, included employees and the extra-employee rate only — no module lists. |
| Larger organisations | BUSINESS list price scales per employee; 1,000+ and private deployment are "Talk to us" (help@flowacord.com), not a fourth card. |
| Prices | Exclude GST (18%: CGST+SGST in-state, IGST otherwise). Editable in `/platform/plans` without a redeploy. |

## 2. State before the change

- Plans: Starter ₹49 / Operations ₹79 / Multi-Branch ₹119 **per employee per month** (annual ₹39/₹69/₹99), `billing_plans`.
- **No company on a paid plan; `billing_payments` empty** (checked 29 Sept 2026). Online payment not yet open (Razorpay live keys pending).
- Companies: 2 internal (placeholder, sample), 5 self-serve trials. Trial package: Employees, Attendance, Leave, Notifications, Payroll, Daily reporting (+ Tasks for some earlier sign-ups).
- On payment, `applyPlanModules` **switched off and locked** every module not in the plan.

Because nothing had been sold, the model could change in place with no customer migration.

## 3. What changed (29 Sept 2026)

**Code**
- `src/lib/billing/pricing.ts` — `quote()` = base (for the cycle) + extra employees × extra rate, then GST; `PlanPrice`, `cyclePrices()`, `monthsFree()`.
- `src/lib/billing/plan-modules.ts` — a module outside the plan is left exactly as it is; never switched off or locked by paying or by "apply plan".
- `src/lib/billing/invoice.ts` + invoice page — two lines: the plan for the period (qty 1), then additional employees (qty × rate).
- `src/lib/billing/actions.ts` — payment rows store base, included, extra count and extra rate.
- `src/lib/marketing/plans.ts`, `src/components/marketing/Pricing.tsx`, `/pricing`, homepage section — the three cards, "Most popular" on PRO, monthly/annual toggle with "Save 2 months", enterprise line.
- `/subscription` — plan cards and a summary with base + extra employees + GST.
- `/platform/plans` — editor fields for base monthly/yearly, employees included, extra monthly/yearly; validation (yearly ≤ 12 × monthly).
- `src/lib/platform/trial-defaults.ts` — `STARTER_MODULES`; fallback trial package.
- Tests: `billing.test.ts` (including the brief's 100/150/250/500/1,000/2,000 list prices), `billing-integration.test.ts` (30 employees on CORE: two invoice lines; Expenses kept).

**Database** — two migrations, split so the build still live during the switch never breaks:

| Step | Migration | Applied | What it does |
|---|---|---|---|
| 1 | `20260929220000_core_pro_business_pricing` | 29 Sept 2026 | Adds `includedEmployees`, `extraEmployeeMonthly`, `extraEmployeeAnnual` to plans; `baseRupees`, `includedEmployees`, `extraEmployees`, `extraRateRupees` to payments (legacy `rateRupees` made nullable); hides the three old plans; creates CORE/PRO/BUSINESS **hidden**; sets the trial package to the Starter set (audited as `platform.trial_settings_changed`). |
| 2 | `20260929230000_offer_core_pro_business` | **after the new build is live** | Offers CORE/PRO/BUSINESS (`active = true`). |

Between the steps no plan is offered: the website shows the list built into whichever code is live, and `/subscription` says plans are being updated (payment is not open anyway). Applying step 2 before the new build is live would show "₹1,499 per employee" on the old build.

**Later clean-up**: drop `billing_payments.rateRupees` once no build that writes it can be live.

## 4. Active-employee definition

Billing counts `tenant_memberships` with status ACTIVE at the moment the order is created (owner, admins and viewers included; invited, suspended and deactivated excluded). The brief recommends "active employment record during the billing period, excluding exits after the exit effective date" — that needs exit dates (see the audit) and is left for the billing phase.

## 5. When modules are tiered (future) — migration rules

From brief §13, applied to FlowHRMS:

1. **Never remove automatically.** Already true in code: paying or applying a plan only adds.
2. **Snapshot first.** Before assigning any company to a tier, export each company's `tenant_module_settings` (enabled, allowedByPlatform) and keep it with the change record.
3. **Grandfather explicitly.** A module a company has that its new tier lacks stays on, and is recorded as grandfathered (new field or table, so a later "apply plan" cannot mistake it for a plan module).
4. **Preview before applying.** `/platform/plans` "Apply modules to companies" needs a preview listing, per company, what would be added — today it applies directly.
5. **Tell customers before a commercial change**; the change is a business decision, never an automatic side effect of a deploy.
6. **Downgrades keep data.** A switched-off module should become read-only rather than invisible (today all access is blocked).

Existing companies at 29 Sept 2026 to map when tiers exist: GROUP G (8 optional modules added by Flowacord), Amit Book Depot ×2, FX & Float, Kamal sattu (trials with Payroll/Tasks), plus the two internal companies.

## 6. Still missing from the brief's §11 (billing engine)

Not built, and not part of this change: upgrade/downgrade with proration or scheduled plan changes; coupons, discounts and partner pricing; negotiated enterprise price overrides (keeping BUSINESS entitlements); add-on quantities (FieldTrack seats); usage metering (WhatsApp, AI); auto-renewal; credit notes; a subscription console with billable employee count, overrides, add-ons and effective dates. `IMPLEMENTATION_PHASES.md` places these in Phase 1B.

## 7. Verification (29 Sept 2026)

- 807 tests pass, including the rolled-back database test of a CORE payment with 30 employees (₹1,499 + 5 × ₹49 = ₹1,744 + GST; invoice lines 1 × ₹1,499 and 5 × ₹49; Expenses kept, Payroll untouched).
- Local `/pricing` and homepage: CORE/PRO/BUSINESS, monthly and annual figures, "Save 2 months", "Most popular" on PRO, enterprise line; one column on a 375 px phone with no sideways scroll.
- Step 1 applied; `prisma migrate diff` against the live database reports no difference from the schema.
