# FlowHRMS — Module Gap Audit (Phase 0)

Version: 1.0 | Date: 29 September 2026 | Repository HEAD at audit: `3b0ec7e` | Status: read-only audit, no code changed for it.

Audited against *FlowHRMS Pricing, Packaging & Module Implementation Brief* (§8 Field workforce, §9.1–9.14 module catalogue, §11–13 billing, entitlements, migration). Companion documents: `PLAN_ENTITLEMENT_MATRIX.md`, `PRICING_MIGRATION_PLAN.md`, `IMPLEMENTATION_PHASES.md`.

## How to read this

| Status | Meaning |
|---|---|
| **COMPLETE** | Production-ready UI + backend + permission check (`checkAccess`) + validation + tests + audit events. |
| **PARTIAL** | Some pieces exist; the note says what is missing. |
| **MISSING** | No meaningful implementation. |
| **HIDDEN/UNUSED** | Built (or switchable) but not reachable, or a switch with no code behind it. |
| **REBUILD ADVISED** | Exists but is unsafe or does not do what it claims. |

Method: five parallel read-only reviews of `prisma/schema.prisma`, `src/lib/**`, `src/app/**`, `src/tests/**` and `docs/md/**`. A screen alone was not counted as complete; a missing screen was not counted as missing if the library and schema carried it.

## Architecture facts that shape every gap

- **Tenant isolation is done in application code.** Every action takes `tenantId` from the session. `scripts/setup-rls.ts` enables RLS with no policies (deny-all for anon/authenticated); Prisma connects as the table owner and bypasses it. There is no dedicated cross-tenant test suite. Each new module must get this right itself.
- **An employee is a `TenantMembership`.** There is no separate employee, custom-field, lifecycle or candidate table.
- **No background scheduler.** The only API route that runs work is the Razorpay webhook. Reminders, escalation, recurring tasks, scheduled reports, retention purges and retries have nothing to run on.
- **Notifications are in-app only.** Email is used for invites, sign-up, password and billing receipts; the notification matrix (`/admin/settings/notifications`) is stored but never read when sending.
- **No native app.** Location is browser `getCurrentPosition` in the foreground only. `docs/md/mobile/*` are plans (28 Sept 2026), nothing implemented.
- **Payroll is deliberately "payroll inputs".** `DECISIONS.md` D-P3-01: "FlowHRMS ships NO statutory formulas"; approval requires "checked with your accountant". The brief's CORE promise of PF/ESI/PT/TDS *calculations* contradicts a recorded product decision.
- **Many switches do nothing.** Feature flags `gps_capture`, `offline_capture`, `late_penalty`, `late_exemption`, `outside_area_approval`, `PAYROLL.overtime/advances/loans/incentives/bonus/payslip_delivery`, `TASKS.recurring_tasks/multiple_assignees/proof_video/gps_proof`, `daily_report`, and permissions `attendance.override`, `location.view`, `tasks.reassign` exist and can be toggled, but no code reads them. The ASSETS, ANNOUNCEMENTS, APPROVALS and GPS_TRACKING modules are catalogue names only.

---

## 9.1 Organisation & Core HR

| Capability | Status | Evidence | Notes |
|---|---|---|---|
| Legal entities / companies | MISSING | `tenants` = one company | No group/parent, no switcher; session picks the first active membership. Email/phone globally unique, so one person cannot belong to two companies. |
| Branches / offices / sites | PARTIAL | `branches`, `src/lib/branches/*`, `LocationsCard.tsx`; `branches.test.ts` | CRUD, geofence radius, audited, branch filter. No branch-scoped admins or per-branch statutory data. |
| Departments / teams / cost centres | PARTIAL | `departments`, `src/lib/departments/actions.ts` | Name, head, active. No teams, sub-departments or cost centres; no action tests. |
| Designations / grades / bands | PARTIAL | `designations`, `src/lib/designations/actions.ts` | Designation → access level, rank checks, audited. No grades/bands; no tests. |
| Reporting hierarchy | PARTIAL | `reportingToId` | Only self-reporting blocked (A→B→A cycles allowed). Used by field visits only; leave/attendance route to department head. Manager changes not in audit before/after. |
| Employment types | PARTIAL | `EmploymentType` enum | Set at invite only; not editable, not shown, no policy effect. |
| Employee lifecycle states | PARTIAL | `MembershipStatus` ACTIVE/INVITED/SUSPENDED/DEACTIVATED | No probation, notice or exited states; no exit date. |
| Employee master profile | PARTIAL | `/admin/employees/[id]`, `saveEmployeeAction` | Core fields, audited. No DOB, gender, address; phone/email fixed after invite; no per-employee timeline; no tests. |
| Custom fields / forms | MISSING | — | |
| Employee documents | PARTIAL | `employee_documents`, `src/lib/employees/documents.ts`, ESS `/documents` | Upload → HR verify/reject, views audited, 120 s signed URLs. Admin "upload for them" backend exists but no UI (HIDDEN); employees cannot open their own files; no document types/required list; no tests. |
| Document expiry alerts | MISSING | — | No expiry field. |
| Emergency contacts | MISSING | — | |
| Dependants / nominees | MISSING | — | |
| Statutory identifiers (PAN/UAN/ESIC/Aadhaar) | MISSING | — | |
| Bank details | HIDDEN/UNUSED | `bank.view/edit`, `revealSensitiveAction` | Permission-checked and audited, but returns "Not collected in this version". No storage. |
| Employee directory | PARTIAL | `/admin/employees` | Search, branch filter, 200 cap, no paging/export, no employee-facing directory, not scoped to a manager's team. |
| Organisation chart | MISSING | — | |
| Role-based access control | PARTIAL | `catalog.ts` (29 permissions, 8 templates), `authz/guard.ts`, `/admin/roles`; `flags.test.ts`, `catalog.test.ts` | Consistent server checks. No custom roles, no record scope (see security), no guard against editing your own role. |

## 9.2 Attendance & Time Office

| Capability | Status | Evidence | Notes |
|---|---|---|---|
| Web/mobile punch | COMPLETE | `lib/attendance/actions.ts`, `AttendanceActionCard.tsx`; `attendance_records`, `attendance_punches` | Web/PWA; idempotent taps; server time authoritative; night shifts to 18 h. |
| GPS punch | COMPLETE | `policy.ts assessArea` | >200 m accuracy → UNCONFIRMED, needs reason + approval. `gps_capture` flag never read. |
| Selfie / face evidence | MISSING | — | Media upload used by visit photos could be reused. |
| Geofence | COMPLETE | `Branch.lat/lng/radiusM`; `attendance.test.ts` | Circles only. Outside → reason + exception; nothing silently blocked. |
| Multiple geofences | COMPLETE (per-person assignment PARTIAL) | `candidateBranches`, `any_branch_check_in` | Per person: home location or any location — no named site sets. |
| Shift patterns | PARTIAL | `Shift`, `saveShiftAction` | One fixed shift per person; no breaks/min hours/flexi; no tests. |
| Rotational shifts / rosters | MISSING | — | Marketing (`UseCases.tsx`) mentions rosters. |
| Grace rules | COMPLETE | `lateMinutes()` | Tested. |
| Late / early policies | PARTIAL | `lateMinutes`, payroll `latesPerDeductedDay` | No early-exit detection or escalation; `late_penalty` not enforced. |
| Penalties / exemptions | HIDDEN/UNUSED | `AttendanceRecord.exemptionStatus` | Nothing sets an exemption; `late_exemption` never read. |
| Overtime | MISSING | `PAYROLL.overtime` flag unused | Marketing (`OperatingLoop.tsx`) claims overtime "adds itself up". |
| Comp-off | MISSING | — | |
| Attendance regularisation | PARTIAL | `reviewAttendanceAction`, `ExceptionQueue` | Only for outside-area/unconfirmed exceptions; no general correction request. |
| Missed punch | REBUILD ADVISED | `requestCheckOutCorrectionAction` | No UI calls it; proposed time stored as free text in `checkInReason`; approving never applies the time. |
| Half-day rules | MISSING | — | Half-day *leave* only. |
| Weekly offs | COMPLETE | `work_calendar` policy; `work-calendar.test.ts` | |
| Holiday calendar | COMPLETE | `saveWorkCalendarAction` | Company-wide only (no per-branch/state). |
| Biometric import / integration | MISSING | — | |
| Offline attendance | PARTIAL | `lib/offline/*`; `offline.test.ts` | Queue + clock-skew checks. No service worker (app cannot start offline); iOS may purge IndexedDB. |
| Attendance locks | MISSING | — | Records can be reviewed after payroll approval. |
| Manager approval | PARTIAL | `reviewAttendanceAction` + tiles | **No self-approval block**; company-wide scope; DETAILS_REQUESTED is a dead end. |
| Attendance audit trail | COMPLETE | `attendance.*` audit events | |

## 9.3 Leave

| Capability | Status | Notes |
|---|---|---|
| Leave types | PARTIAL | Fixed enum FULL_DAY/HALF_DAY/EMERGENCY; no CL/SL/EL; `leave` policy never read. |
| Eligibility rules / accrual | MISSING | No balances in V1 by design. |
| No-balance leave model | COMPLETE | Approver picks paid/unpaid; payroll uses it. |
| Application / approval | PARTIAL | Overlap check, offline-safe. No self-approval block; company-wide scope; approved leave cancellable without a manager. |
| Half-day / hourly | PARTIAL | Half-day with part; no hourly. |
| Sandwich / prefix / suffix | MISSING | Request screen counts calendar days; payroll counts working days — they disagree. |
| Comp-off, blackout dates, team calendar, encashment, policy documents | MISSING | |
| Audit trail | COMPLETE | `leave.*` events. |

## 9.4 Payroll & Compliance

| Capability | Status | Notes |
|---|---|---|
| Salary structures | COMPLETE | Effective-dated, simple/bulk/starter-pack modes, audited; actions untested. |
| CTC components | PARTIAL | Monthly gross only; no annual CTC or employer-side items. |
| Earnings / deductions | COMPLETE | Tenant-typed numbers. |
| Attendance-linked payroll | PARTIAL | **Bug: REJECTED/PENDING check-ins count as paid present days.** |
| LOP | COMPLETE | Tested. |
| Overtime | MISSING | |
| Arrears | MISSING | |
| Bonus / incentives | HIDDEN/UNUSED | `addAdjustmentAction` exists, no UI calls it. |
| Variable pay | MISSING | |
| Loans / advances | MISSING | Flags only. |
| Reimbursements (via payroll) | COMPLETE | `settle-payroll.ts`, integration-tested. |
| Payroll preview | COMPLETE | |
| Payroll lock | PARTIAL | **Approval updates run totals but not `payroll_lines`** — payslips can disagree with approved totals. No unlock. |
| Payslips | PARTIAL | Web only; no PDF/email; no PAN/UAN/bank/YTD. |
| Bank advice | MISSING | No bank data. |
| PF / ESI / PT / LWF / TDS | MISSING (calculation) | No rules, ceilings or slabs by product decision. |
| Statutory forms (ECR, ESI return, Form 16, 24Q) | MISSING | |
| Full & Final | MISSING | Deactivated mid-month → no final pay line. |
| Payroll audit | COMPLETE | `payroll.*` events. |
| Accounting / Tally export | MISSING | Marketing `/modules` lists it under "Not included". |

## 9.5 Tasks & Work Management

| Capability | Status | Notes |
|---|---|---|
| Task delegation | PARTIAL | Create/start/proof/review; no edit, cancel, reassign (`tasks.reassign` unused); company-wide visibility; TEAM_LEADER has `tasks.manage` but no screen; no tests. |
| Advanced / multiple assignees | HIDDEN/UNUSED | Flag never read; one assignee. |
| Subtasks / checklists, templates, dependencies | MISSING | |
| Priority / status | PARTIAL | No cancelled/on-hold. |
| Due dates | PARTIAL | `dueMinutes` not settable. |
| Reminders, escalation | MISSING | No scheduler. |
| Recurring tasks | HIDDEN/UNUSED | Switch shown on `/admin/modules`, nothing reads it. |
| Comments / attachments | PARTIAL | Proof notes/files only. |
| Manager dashboard | PARTIAL | Tenant-wide, 50-row cap, no admin task detail. |
| Employee daily work view | PARTIAL (near complete) | Offline-safe proof. |
| Notifications | PARTIAL | In-app; **`proofSubmitted` links to a route that does not exist.** |
| Task ↔ field-visit link | MISSING | |
| Task audit trail | PARTIAL | Global activity log only. |

## 9.6 Expense & Reimbursement

| Capability | Status | Notes |
|---|---|---|
| Categories | COMPLETE | Versioned policy, snapshotted per claim. |
| Policy / limits | PARTIAL | Cap only flags; no grade/period limits or per-diem. |
| Receipt upload | COMPLETE | Private bucket, signed URLs, views audited, tested. |
| Mileage / conveyance | PARTIAL | Only via Field visits travel claim. |
| Advance request | MISSING | Planned E3. |
| Multi-level approval | MISSING | Single step by design. |
| Reject / return | PARTIAL | No "return for correction". |
| Settlement via payroll / outside payroll | COMPLETE | Integration-tested; outside records a reference only. |
| Finance export | MISSING | Planned E4. |
| Employee expense ledger | PARTIAL | History list only. |
| Project / customer / site tagging | MISSING | |

## 9.7 Assets

All eight capabilities **MISSING**. `ASSETS` is a catalogue placeholder that the platform can switch on and a plan can include — with nothing behind it.

## 9.8 Employee Lifecycle

| Capability | Status | Notes |
|---|---|---|
| Pre-boarding | PARTIAL | Invite, resend/revoke, held until owner verified (tested). Account activation only. |
| Onboarding checklist | MISSING | |
| Document collection | PARTIAL | ESS upload + review; no required list or reminders. |
| Probation, confirmation | MISSING | |
| Transfer | PARTIAL | Plain field edit; no effective date/history; manager change not audited. |
| Promotion | PARTIAL | Designation change with reason, audited; no effective date/approval/letter. |
| Compensation revision | PARTIAL | Effective-dated structures; no approval or letter. |
| Resignation, notice, handover, no-dues, exit interview, F&F trigger | MISSING | |
| Alumni / archive | PARTIAL | Deactivation with reason, sessions revoked, records kept; no exit date or rehire. |

## 9.9 Recruitment / ATS

All thirteen capabilities **MISSING** (requisition, approval, openings, sources, profiles, pipeline, scheduling, scorecards, offer approval/letter/acceptance, conversion, analytics). `inviteEmployeeAction` is the natural conversion target.

## 9.10 Performance & Talent

The existing **PERFORMANCE module is a points/gamification engine** (points, streaks, badges, seasons, quests, leaderboard, rewards store, kudos) scored only from attendance and task evidence. Its spec (`PERFORMANCE-MODULE.md`) rules out ratings and opinions. KRA, KPI, goals, OKR, cascading, review cycles, self/manager review, calibration, 360, ratings, competencies, PIP and increment recommendation are **MISSING** and belong in a new module, not in PERFORMANCE. Performance history: PARTIAL (points ledger only).

## 9.11 Engagement & Helpdesk

| Capability | Status | Notes |
|---|---|---|
| Announcements | HIDDEN/UNUSED | Catalogue name only. |
| Policy acknowledgement | MISSING | Consent-notice flow is a reusable pattern. |
| Pulse / employee / eNPS surveys | MISSING | |
| Recognition | COMPLETE (narrow) | Manager → employee kudos, rewards; integration-tested. |
| Helpdesk tickets, SLA, escalations, knowledge base | MISSING | |

## 9.12 Analytics & Reporting

| Capability | Status | Notes |
|---|---|---|
| Dashboards (role-based / custom) | PARTIAL | One fixed admin dashboard. |
| Daily report | PARTIAL | **Bug: "Tasks completed" counts all-time.** |
| Attendance / leave / task analytics | PARTIAL | Counts and CSV; no trends. |
| Payroll / expense analytics | MISSING | |
| Headcount / attrition | PARTIAL | Active count only; no exit data. |
| Field-force analytics | PARTIAL | Field visits report + CSV, tested. |
| Performance analytics | PARTIAL | Points-based. |
| Custom report builder, scheduled reports | MISSING | |
| CSV / XLSX / PDF export | PARTIAL | CSV only (formula-injection safe). |
| Audit reporting | PARTIAL | Last 100 events, no filters/export. |

## 9.13 Integrations & Platform

| Capability | Status | Notes |
|---|---|---|
| REST API | MISSING | Server actions only; no API keys or rate limits. |
| Webhooks | PARTIAL | Inbound Razorpay only (HMAC, idempotent). |
| SSO | MISSING | Password sign-in only. |
| Email | PARTIAL | Transactional SMTP; not a notification channel; no retry. |
| WhatsApp | HIDDEN/UNUSED | Locked switch; no provider. SMS (MSG91) code paused, unused. |
| Tally / accounting export | MISSING | |
| Biometric devices | MISSING | |
| Calendar integration | MISSING | |
| Import / export framework | PARTIAL | Export only; no bulk import. |
| Integration logs | MISSING | |
| Retry / queue | PARTIAL | Client offline queue, idempotency keys; no server job queue. |
| Feature flags / entitlements | PARTIAL | See `PLAN_ENTITLEMENT_MATRIX.md`: plan entitlement and tenant settings are mixed; no rollout flags or limits. |
| Multi-tenant isolation | PARTIAL | App-level; catalogue tables not in RLS list; no isolation test suite. |
| Audit logs | PARTIAL (strong) | Widely used, before/after; append-only by convention, no trigger. |
| Notification service | PARTIAL | In-app only. |

## 9.14 AI Layer

All items **MISSING**. No AI SDK in `package.json`. The permission and audit framework could carry an AI audit trail later.

## §8 Field Workforce Management

| Capability | Status | Notes |
|---|---|---|
| Punch with GPS + selfie + policy | PARTIAL | Selfie missing. |
| Working status | PARTIAL | Board statuses exist; no "on break". |
| Live / periodic location trail | MISSING | Deliberately excluded: taps only; notice v3 promises "never continuously". |
| Route / location timeline + retention | PARTIAL | Built from taps; polylines dropped after 30 days; raw coordinates retention not configurable, no purge job. |
| Visit check-in/out | COMPLETE | Field visits (29 Sept 2026), tested. |
| Purpose / notes / photo / customer acknowledgement | PARTIAL | No customer OTP/signature. |
| Task linked to visit | MISSING | |
| Distance / travel calculation | COMPLETE | Google Routes with back-off; verified live 29 Sept 2026. |
| Expense claim from field visit | COMPLETE | Monthly travel claim. |
| Manager field-force dashboard | COMPLETE | Reporting-line scope enforced. |
| Offline capture + sync | PARTIAL | No service worker. |
| Spoofing / impossible-travel flags | MISSING | |
| Battery-conscious Android | MISSING | No Capacitor project. |
| Consent, retention, admin audit | PARTIAL | Optional visit-location consent; admin *views* of location not audited. |
| DPDP purpose limitation | PARTIAL | `checkin_location` is a required purpose — withdrawing it means withdrawing all consent. |

The FIELD_VISITS module is live but in no plan: companies get it only when Flowacord adds it per company.

## Billing (§11) — current state in brief

Detail and the change made on 29 Sept 2026 are in `PRICING_MIGRATION_PLAN.md`. Before that change: per-employee pricing (Starter ₹49, Operations ₹79, Multi-Branch ₹119), no included employees, no proration, no overrides, no add-ons or metering; GST invoices complete (frozen, trigger-protected, numbered per financial year); **paying switched off and locked every module not in the plan** — the §13 risk, fixed on 29 Sept 2026.

---

## Security and correctness findings (fix before building on top)

Ranked most severe first. None was changed in Phase 0.

1. **Owners can be suspended by lower roles.** `saveEmployeeAction` (`src/lib/employees/actions.ts`) lets anyone with `employees.manage` (HR, Admin) set an Owner or Super Admin to SUSPENDED/DEACTIVATED — no rank, self or last-owner check. `deactivateEmployeeAction` also has no rank check.
2. **Role self-escalation.** `saveRolePermissionsAction` protects only the OWNER role; a Super Admin can add `payroll.approve` or `bank.*` to their own role.
3. **Self-approval** of attendance exceptions and leave (`reviewAttendanceAction`, `decideLeaveAction`), and approval scope is company-wide rather than the reporting line.
4. **Document paths not tenant-validated.** `saveDocumentAction` accepts any `path`; uploads use `${membershipId}/…` with no tenant prefix (expenses and media do check). Document opening may also be broken (signed URLs with the user client while storage SELECT policies are removed) — check in staging; switching to the service key without fixing the path check would open cross-tenant reads.
5. **Payslips can disagree with approved totals**, and Calculate is not atomic (`src/lib/payroll/actions.ts`).
6. **Rejected attendance still pays** (`src/lib/payroll/summary.ts`).
7. **Adjustments can land on approved runs**; the expense→payroll seam does not lock the run.
8. **Missed-punch correction never applies the time** (REBUILD ADVISED above).
9. **`saveSalaryComponentAction` resets `isStatutory` to false** on every save.
10. **Managers/Team Leaders/Viewers see the whole company** (no record scope) despite `/admin/roles` and USER-ROLES.md saying otherwise; `/print/id-cards?all=1` open to `employees.view`.
11. **Dead switches** that admins can toggle (listed at the top) and marketing claims (overtime, rosters) that the product does not deliver.
12. Smaller: reporting-line cycles; duplicate employee code on edit throws unhandled; `reviewedById` stores a membership id while `uploadedById` stores a user id; dashboard "Recent activity" visible without `audit.view`; notification matrix ignored.

## Tests — what is and is not covered

- **Covered well (pure logic):** attendance rules, branches, work calendar, leave maths, offline queue, consent chain, field visits (state, team, policy, routes, conveyance), payroll engine, expenses state machine, performance scoring, action tiles, catalog/flags, billing.
- **Database integration:** billing, consent, expenses, expenses↔payroll, field-visit legs, invites (held), kudos, rewards — run one file at a time since 29 Sept 2026.
- **Not covered at all:** employee/department/designation/role actions, document actions, audit, shift/exemption/correction/review/leave actions, task actions, report export, notification fan-out, dashboard queries, payroll approval, payslip loading.
