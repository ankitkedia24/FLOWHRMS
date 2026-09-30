# FlowHRMS - User Roles and Access Model

Version: 0.1  |  Date: 07 August 2026  |  Status: Draft for approval

## Access model
Access is the intersection of tenant membership, active module/feature, role permission, reporting scope, and record ownership. Roles are templates; granular permissions are the enforcement unit. Tenant Owners may delegate access but cannot bypass platform controls.

## Platform Super Admin
Operates FlowHRMS across tenants: tenant lifecycle, plans, module catalog, support access policy, platform analytics, and controlled impersonation/support with audit. Cannot casually browse payroll or employee files; exceptional access must be justified, time-bound, and logged.

## Tenant Owner
Full company control: company settings, admins, modules within plan, policies, payroll approval, reports, and retention choices. May appoint Super Admins inside the tenant.

## Tenant Super Admin and Admin
Manage users, employees, policies, attendance exceptions, leave, tasks, reports, and approved modules. Payroll access should be separately permissioned. Super Admin is a delegated operational authority; Admin is configurable by permission set.

## HR
Maintains employee records, documents, leave workflow, attendance review, and payroll inputs. HR cannot change subscription, platform configuration, or sensitive owner controls unless explicitly granted.

## Manager and Team Leader
View and manage their reporting tree; assign/review tasks; approve requests when configured; see limited reports. They should not see confidential payroll, bank, or identity data by default.

## Employee and Viewer
Employee views and acts on own attendance, leave, tasks, documents, payslips, and notices. Viewer is read-only and must have a defined record scope.

## Minimum sensitive permissions
Separate permissions for salary view/edit/approve, bank details view/edit, document download, location view, attendance override, leave approval, policy edit, task reassignment, export, and audit-log view.

## Give this to Claude
Create a role-and-permission management UX that starts with safe role templates and permits granular overrides. Make record scope and sensitive-data access visible before saving changes.

---

# Amendment 1 — Invitation and department authority
*Approved 10 August 2026. Appended, not rewritten.*

## Who may invite

`employees.manage` — the existing permission — now also covers inviting,
resending, withdrawing and deactivating. It is held by Owner, Super Admin,
Admin and HR in the default templates; Manager and Team Leader do **not**
hold it, so they cannot create logins.

No new permission was added. Inviting is adding an employee, and splitting
it would let a tenant grant "can add people" without "can give them
access", which is not a distinction an SME wants to reason about.

## Department head

A department head is a **membership**, not a role. Being a head does not
grant any permission; it only adds someone to the audience for their
team's decisions, and they must already hold the deciding permission for
the tile to reach them.

That constraint is deliberate. Sending an Approve button to someone whose
role cannot approve produces a button that fails when pressed. Instead the
department screen states the gap in words — *"Meera heads Dispatch but
their role can't approve anything, so requests go to admins only"* — so
an owner can fix it rather than wonder why nothing arrives.

## Deciding permissions

| Decision | Permission |
|---|---|
| Attendance exception | `attendance.review` |
| Leave request | `leave.approve` |
| Task proof | `tasks.manage` |
| Outstanding invitation | `employees.manage` |

## Protections

- Nobody decides their own request, whatever their role — including a
  department head deciding about themselves.
- The last active Owner cannot be deactivated. A company must never be
  left with nobody who can manage it.
- Nobody can deactivate their own account.

---

# Amendment 2 — Deciding your own, and requests waiting on a question
*Approved by the owner, 30 September 2026 (Hardening batch 2). Appended, not rewritten.*

- Nobody decides their own leave or attendance exception. The **Owner** is
  the one exception: nobody sits above them, so refusing would leave their
  own requests undecidable. Their own requests reach their tiles; everyone
  else's own are left out of their queues and tiles.
- The first final decision wins. Two approvers pressing at once get one
  decision; the other is told "Already decided. Open the activity log to
  see who decided."
- Ask for details needs the question. The employee sees it ("Your approver
  asked: …") and the request stays in the queue, still decidable.

---

# Amendment 3 — Record scope
*Approved by the owner, 30 September 2026 (Hardening batch 6). Appended, not rewritten.*

- **Owner, Super Admin, Admin and HR** see the whole company.
- **Everyone else** (Manager, Team Leader, Viewer, and any role a company
  adds) sees their team: whoever reports to them, directly or through
  others, plus the members of any department they head. They always see
  themselves in lists, but are never in their own team for a decision.
- Applied on the server before any permission: the employee list and
  profile (outside the team: not found), attendance and leave queues and
  decisions, tasks (list, assigning, proof review and proof files), ID
  cards, the dashboard, the daily report and report exports, and who an
  approval tile or bell reaches. Refusals say "That person isn't in your
  team."
- A Manager with nobody reporting to them and no department sees only
  themselves. Set reporting lines and department heads to give them a team.
- Field visits keep their own reach (FIELD-VISITS-MODULE.md §5). Expense
  claims are not yet narrowed by this rule.
