# FlowHRMS — Plan Entitlement Matrix (Phase 0)

Version: 1.0 | Date: 29 September 2026 | Status: the brief's intended matrix set against what exists and what each plan actually unlocks today.

Companions: `MODULE_GAP_AUDIT.md` (status evidence), `PRICING_MIGRATION_PLAN.md` (the pricing change), `IMPLEMENTATION_PHASES.md`.

## 1. What each plan unlocks TODAY (29 Sept 2026, owner decision)

Tiering by module is **deferred**: the owner will decide modules tier by tier, phase by phase. Until then:

| | CORE | PRO | BUSINESS | New free trial |
|---|---|---|---|---|
| Price | ₹1,499/mo, 25 incl., +₹49 | ₹2,999/mo, 50 incl., +₹59 | ₹6,999/mo, 100 incl., +₹49 | Free, 30 days |
| Annual | ₹14,990, +₹490/extra/yr | ₹29,990, +₹590/extra/yr | ₹69,990, +₹490/extra/yr | — |
| Modules unlocked | Starter set | Starter set | Starter set | Starter set |

**Starter set** = Employees, Attendance, Leave, Daily reporting, Notifications (the old Starter plan's modules). Payroll, Tasks, Performance, Expenses, Field visits and the rest are added **per company** by Flowacord from `/platform/companies/[id]`.

Rules in force:
- **Paying never removes a module a company already has** (`applyPlanModules`, brief §13). It only switches on the plan's modules that the company lacks.
- The website and `/subscription` show **prices only** — no module lists — until tiers are decided. A plan's bullet points (edited in `/platform/plans`) appear automatically when added.
- Companies on a trial before 29 Sept 2026 keep what they had (most have Payroll and Tasks; GROUP G has 8 optional modules added by Flowacord).

## 2. The brief's matrix (§4) against today

"Built" is the module-audit status; "Carried by" is the catalogue module or feature that would gate it.

| Capability | CORE | PRO | BUSINESS | Built today | Carried by |
|---|---|---|---|---|---|
| Core HR / employee records | ✓ | ✓ | ✓ | PARTIAL | EMPLOYEES |
| Employee documents | ✓ | ✓ | ✓ | PARTIAL | EMPLOYEES |
| ESS / mobile access | ✓ | ✓ | ✓ | PARTIAL (PWA, no native app) | core shell |
| Attendance / leave / shifts | ✓ | ✓ | ✓ | Attendance COMPLETE-ish, Leave PARTIAL, Shifts PARTIAL | ATTENDANCE, LEAVE |
| GPS punch | ✓ | ✓ | ✓ | COMPLETE | ATTENDANCE |
| Selfie attendance | ✓ | ✓ | ✓ | **MISSING** | — (new feature under ATTENDANCE) |
| Advanced geofencing | Basic | ✓ | ✓ | Basic COMPLETE; per-person site sets PARTIAL | ATTENDANCE `any_branch_check_in` |
| Offline attendance | – | ✓ | ✓ | PARTIAL (no service worker) | ATTENDANCE `offline_capture` (flag not enforced) |
| Field status / visit tagging | – | ✓ | ✓ | COMPLETE (Field visits) | FIELD_VISITS |
| Live / location trail during work | – | ✓ | ✓ | **MISSING** (deliberately; needs native app + new consent) | GPS_TRACKING (placeholder) |
| Payroll + statutory calculations | ✓ | ✓ | ✓ | Payroll inputs COMPLETE; **statutory MISSING by decision D-P3-01** | PAYROLL |
| Advanced variable pay / incentives | Basic | ✓ | ✓ | MISSING (hidden adjustment action only) | PAYROLL `incentives`/`bonus` (flags unused) |
| Expenses / reimbursements | – | ✓ | ✓ | COMPLETE (single-level) | EXPENSES |
| Assets | – | ✓ | ✓ | **MISSING** (placeholder) | ASSETS |
| Task management | Basic | Advanced | Advanced | Basic PARTIAL; advanced MISSING/HIDDEN | TASKS |
| Confirmation / transfer / exit | Basic exit | ✓ | ✓ | Deactivation only; workflows MISSING | EMPLOYEES |
| Workflow builder | – | ✓ | Advanced | MISSING | APPROVALS (placeholder) |
| WhatsApp automation | Usage | Usage | Usage | MISSING (locked switch) | NOTIFICATIONS `whatsapp` |
| Biometric integration software | – | ✓ | ✓ | MISSING | — |
| Tally / accounting integration | – | ✓ | ✓ | MISSING | — |
| Multi-branch | Basic | ✓ | ✓ | PARTIAL (strong for attendance; no branch-scoped access) | core (branches) |
| Multi-company | – | – | ✓ | MISSING | — |
| ATS / recruitment | – | – | ✓ | MISSING | — |
| Performance / KRA / KPI | – | – | ✓ | MISSING (existing PERFORMANCE is gamification) | new module |
| OKR, 360 feedback | – | – | ✓ | MISSING | new module |
| Engagement surveys | – | – | ✓ | MISSING | — |
| HR helpdesk | – | – | ✓ | MISSING | — |
| Advanced analytics | – | – | ✓ | PARTIAL (counts + CSV) | DAILY_REPORTING |
| AI HR assistant | – | – | ✓ / usage | MISSING | — |
| API / webhooks | – | Standard | ✓ | MISSING (inbound Razorpay only) | — |
| SSO | – | – | ✓ | MISSING | — |
| Dedicated success manager | – | – | Qualifying | Commercial, not software | — |

Items already built but **not in the brief's matrix**: Daily reporting, Performance & Leaderboards (points, rewards, kudos), Notifications. The owner decides where these sit when tiering.

## 3. How entitlement works in code today

- **Plan → modules**: `billing_plans.modules` (edited in `/platform/plans`). Applied on payment (`issueInvoiceTx` → `applyPlanToTenant`), on a manual plan set, or by "Apply modules to companies". Only ever adds since 29 Sept 2026.
- **Company → module**: `tenant_module_settings.enabled` (the company's switch) and `.allowedByPlatform` (Flowacord's "in your plan"). `/platform/companies/[id]` switches both per company.
- **Enforcement**: server-side. `checkAccess` / `requireAccess` → `evaluateAccess` denies when a non-core module is not `enabled`; used across ~76 files. `allowedByPlatform` is checked when a company tries to switch a module on (`src/lib/modules/actions.ts`).
- **Trial package**: `platform_settings.trial.modules`, edited in `/platform/settings` (now the Starter set).
- **Features inside a module**: `tenant_feature_settings` + `user_feature_exceptions` — tenant configuration, *not* commercial entitlement. Several of these switches are dead (see the audit).

## 4. Gap to the brief's §12 (entitlements vs feature flags)

| Brief requirement | Today | Gap |
|---|---|---|
| One entitlement system for plan gating | Module lists per plan + per-company `allowedByPlatform` | Workable base; entitlement is module-level only, not capability-level (`tasks.advanced`, `expenses.enabled` style keys don't exist). |
| Separate feature-flag system for staged rollout | None at platform level | Missing: e.g. `new_field_map_ui`, `ai_hr_assistant_beta`. `tenant_feature_settings` must not be reused for this. |
| Limits (`included_employees`, `max_companies`, `storage_gb`, `api_rate_limit`, `fieldtrack_seats`) | `includedEmployees` on plans (pricing only, not a limit) | Missing as enforced limits. |
| Testable, centrally observable decisions | `evaluateAccess` is pure and tested | Decisions are not logged. |
| Server-side enforcement | Yes, for modules | Needed for any new capability-level entitlement. |
| Graceful downgrade (keep data, restrict new use) | A module switched off blocks all access, including reading history | Needs read-only mode for switched-off modules. |

## 5. Decisions the owner still has to make (when tiering)

1. Which modules go into CORE, PRO and BUSINESS — including where Payroll, Tasks, Performance, Expenses and Field visits sit.
2. Whether CORE can promise "PF / ESI / PT / TDS calculations" — this reverses decision D-P3-01 and needs statutory-rule work plus accountant/legal review.
3. What existing companies keep when tiers arrive (grandfathering; see `PRICING_MIGRATION_PLAN.md` §5).
4. Whether a live location trail (PRO) ships at all, given the published notice promises "never continuously", and the FieldTrack add-on price.
