# FlowHRMS - Modules and Dependencies

Version: 0.1  |  Date: 07 August 2026  |  Status: Draft for approval

## Core platform
Identity and Tenant Settings manage company profile, branches, users, roles, access, and policies. Module Management controls tenant and user eligibility. Notifications delivers in-app, push, email, SMS, or WhatsApp through configured providers. Audit and Reporting provide evidence and exports.

## V1 modules
Employee Management: profiles, employment information, reporting manager, documents, status, and timeline. Attendance: check-in/out, time/location capture, shifts, exceptions, calendar, late rules, and admin review. Leave: request, approve/reject, half-day/emergency leave, and payroll effect. Payroll: salary structures, period calculations, adjustments, review, and payslips. Tasks: assignments, priority, due date/time optional, notes, files, proof, status, and recurring templates. Daily Reporting: summaries of attendance, task status, exceptions, and configured delivery. Performance and Leaderboards: attendance and task-derived indicators only, with transparent definitions.

## Optional V1 modules
Expenses, Assets, Announcements, Approvals, and GPS Tracking may be enabled per tenant only when their detailed rules are approved. "GPS Tracking" refers to event-based attendance/task proof, not continuous covert tracking by default.

## Dependency rules
Payroll requires Employee Management and Attendance; it may consume approved Leave. Leave requires Employee Management. Tasks requires Employee Management. Performance requires Attendance or Tasks. Leaderboards require their source module and a published scoring definition. Daily Reporting depends on the modules included in the selected summary. Disabling a required module must show impact and block or require a safe migration decision.

## Excluded from V1
Visitor Register, biometric hardware sync, face recognition, QR/RFID attendance, bank transfer generation, Tally/Busy/Zoho integrations, CRM, inventory, and continuous location tracking.

## Give this to Claude
Use these modules and dependencies to create the information architecture. Show only enabled modules in a tenant's navigation. Before designing an optional module, ask whether its detailed requirement document is approved.

---

# Amendment 1 — Onboarding and Departments
*Approved 10 August 2026. Appended, not rewritten.*

## Employee Management — extended

Employee Management now covers the whole lifecycle, not just the record:

- **Add and invite.** Name, mobile number, email (optional), employee ID,
  department, designation, reporting manager, joining date, employment
  type and role. Only name, mobile and role are required.
- **Invitation state** on the directory and the profile: Pending,
  Accepted, Expired, Revoked, or "Not invited" for someone with no email.
- **Resend** (new token, old one dies), **withdraw**, and **deactivate**
  with a reason.
- **Departments** and their heads, configured under Settings.

Deactivation never deletes. Attendance, leave, tasks and payslips are
evidence and stay exactly as recorded.

## Notifications — extended

Notifications now has two distinct outputs, and the distinction is load-
bearing:

| | The bell | The action tile |
|---|---|---|
| Says | something happened | someone must decide |
| Raised for | assignments, decisions, arrivals | exceptions, leave, proof |
| Clears when | read | **decided** — reading is not deciding |
| Audience | the person concerned | everyone who can decide, plus the department head |

The tile carries Approve (only where approving needs no further input),
a link to the full decision screen, and Snooze. It is not a modal: a
decision request arrives while someone is doing something else, and
blocking their screen to demand attention is how a queue gets ignored.

**Deliberately not raising a tile:** ordinary check-ins, check-outs, task
assignments to oneself, and anything else with no decision attached. Those
go to the bell.

## Dependency rules — addition

Departments belong to Employee Management. With Employee Management
disabled, departments are unreachable and action tiles fall back to
tenant admins — they are never silently dropped.

# Amendment 2 — Performance point sources beyond attendance and tasks
*Approved 18 August 2026 with PERFORMANCE-MODULE.md. Appended, not rewritten.*

## Performance & Leaderboards — extended

The module's binding sentence stands: indicators derive from recorded
evidence with transparent, published definitions — never from opinions or
manual entries. This amendment adds three narrow, evidence-based point
sources that are not attendance or task events:

- **Planned leave.** A leave request submitted at least N days before its
  start date (N tenant-editable, default 3) earns points when APPROVED.
  The evidence is the request's own creation timestamp, which nobody can
  backdate. Rewarding notice turns the leave calendar from a surprise
  into a plan.
- **Onboarding complete.** One-time: at least one document VERIFIED and
  the workforce profile filled in (designation, department, branch,
  shift). The evidence is the document review decision and the profile
  record.
- **Work anniversary.** Points per completed year of service, judged from
  `joinedOn` at date granularity. One award per year count, ever.

Each source is an individually switchable rule with its own value in the
published scoring definition, like every other rule. Nothing here
introduces manual scoring, and nothing here can deduct.

# Amendment 3 — Expenses: rules, permissions and payroll independence

The Expenses module’s detailed rules are EXPENSES-MODULE.md (v1.2; approved 4 September 2026, E1 built the same day). It adds two permissions to USER-ROLES.md — `expenses.approve` (approve and settle claims; default Owner, Super Admin, Admin, HR) and `expenses.view` (see others’ claims; default additionally Manager) — and, from E3, one feature flag to FEATURE-FLAGS.md, `EXPENSES.advances` (default off). Expenses has no module dependency. Payroll is a settlement route offered only when the Payroll module is enabled for the tenant; a tenant without Payroll settles claims outside payroll. Claims never earn Performance points. A submitted claim can be withdrawn by its claimant only, before any decision; the withdrawal is terminal and audited. As with every optional module, Expenses is enabled for a tenant by the FlowHRMS platform contact; the tenant’s admin then publishes the expense rules, and nothing can be claimed before that.

---

# Amendment 4 — Field visits

The Field Visits module's detailed rules are FIELD-VISITS-MODULE.md (v1.0; approved from UI mockups 29 September 2026, Phase 1 built the same day). It is an optional module that requires Attendance: a trip happens inside an open working day. It records location only at four taps (Going out, Reached, End visit, Back at office) — never continuously and never between taps — so the exclusion of continuous location tracking above stands. It adds one sensitive permission to USER-ROLES.md, `fieldvisits.view` (see everyone's trips and visits; default Owner, Super Admin, Admin); reporting managers see their direct reports and department heads their department without it. Owners never record visits. Going out raises an approval tile (ActionRequest kind `FIELD_TRIP`) for the reporting manager without stopping the trip; the other taps send information notices. Road distance between tapped spots feeds a monthly travel allowance claim in Expenses: an ordinary expense claim in the fixed category "Travel allowance" (never a receipt, one per person per month), approved and settled through Expenses, with the kilometres' evidence fixed beside it. It needs Expenses switched on with its rules published; Field visits itself does not depend on Expenses. As with every optional module, Field visits is enabled for a company by the FlowHRMS platform contact; the company's admin then publishes the field visit rules, and nothing can be recorded before that.
