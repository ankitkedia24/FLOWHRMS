# FlowHRMS - FlowHRMS Pack 01 - Foundation

Version: 0.1  |  Date: 07 August 2026  |  Status: Draft for approval

## Purpose
This pack freezes the first product decisions for FlowHRMS (FlowHRMS): a mobile-first, multi-tenant SaaS for practical workforce operations. It covers attendance, leave, payroll, task delegation, reporting, and tenant-controlled modules. It is a product definition, not application code.

## What is decided
FlowHRMS serves Indian SMEs first, especially operational businesses such as hardware, trading, warehouse, dispatch, delivery, and field teams. Each company is a tenant. A platform owner manages the SaaS; each tenant manages its own people, policies, enabled modules, and data.

The V1 core is Employee Management, GPS Attendance, Leave Approval, Attendance-Based Payroll, Tasks, Daily Reporting, Notifications, Employee Documents, Reports, and Module Management. No predefined holiday calendar, earned-leave balance, visitor register, or V2 integrations are included in V1 unless later approved.

**Approved 27 Sept 2026 — work calendar.** Each company sets its weekly off days (Sunday by default) and its own holiday list; any employee may have their own weekly off. Weekly offs and holidays are paid, never counted as absent, and a check-in on one is never late. Leave counts working days only (no sandwich rule). There is still no *predefined* holiday list — the company enters its own. Earned-leave balances remain out of scope.

## Working order
1. Approve this Pack 01.
2. Create and approve the FlowHRMS brand, logo, design tokens, mobile-first UI kit, landing page, and prototype in Claude Design.
3. Complete detailed rules for attendance and payroll before implementation.
4. Begin code only after the above approvals.

## Folder map
`docs/` holds approved source documents. `assets/` holds brand and visual files. `ui/` holds approved design exports. `prompts/` holds reusable Claude prompts. `decisions/` records changes with date, owner, and reason.

## Source-of-truth rule
When product behavior, a wireframe, and code disagree, the latest approved document wins until it is formally changed. Every material change must update the affected document and `DECISIONS.md`.

## Pack contents
README; Product Bible; Product Constitution; Product Vision; Brand Guidelines; Modules; Feature Flags; System Architecture; User Roles; Roadmap.

## Give this to Claude
Read the complete FlowHRMS Pack 01 before proposing designs or code. Treat it as the source of truth. Do not add features, data rules, or screens that conflict with it. Ask for approval when a requirement is unclear.
