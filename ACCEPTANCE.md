# Acceptance checklist — recorded result

A pass over
`docs/FlowHRMS-Design-Handoff-v1/08-claude-code-handoff/acceptance-checklist.md`,
sections A–K. **An honest record, not a compliance claim.** Where
something has not been verified the way the checklist asks, it says so
rather than being ticked.

Date: 9 August 2026 · Build: multi-location + V1 completion

Legend: **Met** · **Partly met** · **Not met** · **N/A**

---

## A. Design-system conformance

| Item | Result |
|---|---|
| No raw hex, px radius, shadow or duration outside tokens | **Met** — Tailwind's default palette/radius/shadow scales are wiped in `tokens.css` (`--color-*: initial`), so an off-token utility does not compile. Three literal exceptions are documented (D-P1-02). |
| Correct surface context per area | **Met** — `data-surface` at layout level; employee warm canvas + 16px, admin cool + 12px. |
| No warm token on an admin surface | **Partly met** — held by construction and review, **not by an automated lint rule**. The checklist asks for the rule (§K); it is not written. |
| Type scale, weights, minimum sizes | **Met** |
| Times/amounts in mono with tabular figures | **Met** |
| Currency `₹` with Indian grouping; dates `7 Aug 2026`; week starts Monday | **Met** — `formatRupees`, calendar starts Monday. |
| Icons are Lucide, `currentColor` | **Met** |
| Logo per `logo-usage.md` | **Met** |

## B. Content and behaviour

| Item | Result |
|---|---|
| Copy matches the copy deck verbatim where specified | **Met** — fixed status strings pinned by `src/tests/status.test.ts`. |
| Every status renders a word, never colour alone | **Met** — `Status {key,label,tone}` makes colour-only rendering structurally impossible. |
| Consequence shown before activation, and in the accessible name | **Met** — computed contract; the check-in card and server action call the *same* `computeCheckInState`. |
| Reject / disable / override require a reason | **Met** |
| Decisions leave a persistent audit line | **Met** |
| Empty, loading, error and offline states with approved copy | **Met** |
| No partially loaded number, hours or salary | **Met** |
| Every disabled control states its reason | **Met** — `disabledReason` is a required-by-convention prop. |
| Only enabled modules in navigation | **Met** |

## C. Responsive and accessibility

| Item | Result |
|---|---|
| Completes at 360px; reflows at 320px with no horizontal scroll | **Met** — verified in-browser: horizontal scrolling is impossible at 320px. |
| Renders at 768 / 1024 / 1440 and 200% zoom | **Partly met** — 360, 768, 1024 and 1440 checked; **200% zoom not tested**. |
| Tables have a stacked mobile alternative | **Met** |
| Touch targets ≥48 employee / ≥40 admin | **Met** by token; not measured per-element. |
| Primary mobile action full-width, 56px, thumb zone | **Met** |
| Keyboard-only completion; visible focus everywhere | **Partly met** — focus ring is global and the calendar implements the full APG grid pattern; **a keyboard-only pass over every flow has not been done**. |
| Screen-reader pass (NVDA / TalkBack) | **Not met** — no assistive technology was run. Semantics are built to spec (real `<table>`, `<th scope>`, `role="grid"`, live regions) but that is not the same as testing. |
| Contrast audit | **Partly met** — every pairing is pre-verified in the approved palette; no independent audit was run on rendered screens. |
| Colour-blindness simulation | **Not met** — mitigated by status always carrying a word. |
| `prefers-reduced-motion` and forced-colors | **Partly met** — reduced-motion implemented globally; forced-colors not tested. |
| Sticky bars never obscure the focused element | **Not verified** |

## D. The five integrity patterns

| Item | Result |
|---|---|
| Consequence before action as a data contract | **Met** |
| Impact confirm for payroll approval, module disable, permission change | **Partly met** — payroll approval and module disable use it. Permission change uses a **live impact banner** rather than a modal; the roles screen states affected counts before saving. |
| Approval card shared across exceptions, leave, proof | **Met** — payroll adjustments use their own inline form, not the card. |
| Governed switches never flip before the server confirms | **Met** |
| Attendance action card handles every state | **Met** — inside / outside / location-off / late / submitting / confirmed / offline / duplicate-tap / policy-off, plus a new "work location isn't set" state. |

## E. Feature flags and tenancy

| Item | Result |
|---|---|
| Flag evaluation covers tenant → module → feature → role → user exception | **Met** |
| Same decision governs UI, API, jobs, notifications, reports | **Partly met** — governs UI, server actions, notifications and exports. **No background jobs exist yet**, so that half is untested. |
| Server-side denial verified | **Met** — every admin route re-checks; the branch filter is re-validated server-side. |
| Disabling a module removes nav, denies APIs, creates an audit event | **Met** — jobs N/A. |
| Re-enabling restores navigation with data intact | **Met** |
| Tenant-scoped queries, files and notifications | **Met** — plus RLS now enabled on all 25 tenant tables. |
| Support/impersonation session shows a warning band | **Met for the support person** — a persistent strip with Exit; every change attributed to "Flowacord support". By owner decision (D-PL-03) there is no time limit and no band shown to the company. Real companies open only after their owner accepts the updated Terms (docs/md/SUPPORT-ACCESS.md). |

## F. Payroll

| Item | Result |
|---|---|
| Every figure traceable to inputs, policy version, period | **Met** |
| Approval locks; later changes only via adjustment | **Met** |
| Employees without a salary structure excluded **and named** | **Met** |
| Unreviewed exceptions surfaced with counts | **Met** |
| Negative net blocks approval | **Met** |
| Totals reconcile; one documented rounding rule on the payslip | **Met** — totals are summed from rounded lines. |
| No compliance claim; accountant acknowledgement required | **Met** |

## G. Privacy

| Item | Result |
|---|---|
| Location only at check-in/out; no continuous tracking | **Met** |
| Every capture point explains its purpose on screen | **Met** |
| Employees see what was recorded, in the same words | **Met** |
| Salary, bank, documents, location behind permission + explicit action | **Met** — reveal is a deliberate action and is audited. |
| Sensitive access and exports logged | **Met** |
| Retention honoured; export/deletion workflows exist | **Not met** — retention windows are **not agreed or implemented**; there is no self-service export or deletion. Must be settled before production (Constitution §7). |

## H. Offline and reliability

| Item | Result |
|---|---|
| Check-in, check-out, proof, leave queue locally | **Met** — persisted in IndexedDB, so work survives the tab closing. Proof photos are stored as Blobs, not references. Verified in-browser: a check-in made offline was still queued after a page reload, then sent. |
| Queued items keep their capture time | **Met** — and it is the *recorded* time, not just a note: a check-in made at 9 am and synced at 5 pm records 9 am, and lateness is judged against 9 am. A device clock in the future, or an item older than a week, is refused with a reason rather than trusted. |
| Reconnect syncs with one summary | **Met** — one toast ("2 items sent."), never one per item. Sync runs on reconnect, on load, and when the tab becomes visible. |
| Conflicts become exceptions showing both versions | **Met** — a queued check-in clashing with a saved one leaves the saved time standing, records both on the record, raises it for review and notifies. |
| Admin approval/payroll/config unavailable offline | **Met** — never queued, and the admin bar says so plainly. |
| Server time authoritative, echoed back | **Met** — for online actions. Offline actions are device-timed **by design** (edge-cases.md), flagged `offlineCaptured`, with the clock skew recorded for review. |
| Signing out does not silently discard queued work | **Met** — it names what would be lost and offers to send it first. |

## L. Employee invitation and the action queue

*Added 10 August 2026 with the onboarding work.*

| Item | Result |
|---|---|
| Admin creates an employee from the UI | **Met** — name, mobile, email, employee ID, department, designation, reporting manager, joining date, employment type and role. Three required. |
| Auth account created without exposing admin credentials | **Met** — `server-only` module, no `NEXT_PUBLIC_` prefix, key never reaches a client bundle. |
| Invitation email, and password set by the employee | **Partly met** — the flow is built and the invitation page is verified in-browser. **The password-set → sign-in leg has not been run end to end**, because it needs `SUPABASE_SECRET_KEY` and an SMTP account, neither of which is configured yet. |
| Profile and membership linked automatically | **Met** — one transaction; verified by smoke test. |
| Role and permissions assigned | **Met** — chosen at invite, enforced by the existing evaluator. |
| Duplicate email / mobile / employee ID prevented | **Met** — normalised before comparison, so `+91 98765 43210` and `09876543210` are one person. Database constraint backs the check. |
| Resend invitation | **Met** — new token, old one revoked, 2-minute cooldown, capped at 5. |
| Status Pending / Accepted / Expired | **Met** — computed against the clock, so no job is needed to keep it true. |
| Deactivate an employee | **Met** — reason required and kept; sessions revoked; records untouched; last owner protected. |
| Audit for invite, acceptance, resend, deactivation | **Met** — acceptance is recorded as SYSTEM, since the invitee has no session and attributing it to the admin would be false. |
| Tenant isolation at every step | **Met** — every query filtered by session tenant; cross-tenant messages reveal nothing. Verified by smoke test. |
| Action tile with approve / reject / snooze | **Partly met** — approve is inline where approving needs no further input; **reject and leave-approval open the full screen by design**, because a rejection needs a reason and approving leave needs a paid/unpaid choice. A one-tap version of either would hide the consequence. |
| Snooze with a time option | **Met** — 15 min, 1 hour, this evening, tomorrow morning, each naming the resolved wall-clock time. Per person, capped at 5. |
| Notification sound | **Met** — WebAudio chime, off by default, unlocked on a user gesture as browsers require, once per batch rather than once per item. |
| Notification bell | **Met** — counts decisions first, unread notices second; the accessible name states both. |
| Reaches admin and the department head | **Met** — and a head whose role cannot approve is excluded rather than given a button that fails, with the gap stated on the department screen. |
| Automated tests | **Met** — 69 unit tests plus a 20-check database smoke suite. |
| Mobile-first loading / success / error states | **Met** — verified at 375px: no horizontal scroll, disabled controls state their reason. |

## I. Scope discipline

| Item | Result |
|---|---|
| No V2 feature present | **Met** |
| No module, status, role or permission beyond the approved docs | **Met** — one new feature flag added through the documented lifecycle (D-P5-01). |
| Optional modules show `Not available` until approved | **Met** |

## J. Marketing

| Item | Result |
|---|---|
| No customer names, statistics, badges | **Met** |
| No prices — `₹ —` | **Met** |
| Only "Designed for Indian SMEs" as positioning | **Met** |
| No implied statutory compliance | **Met** |
| Screenshots use sample data | **Met** — no product screenshots on the marketing pages yet. |

## K. Release gate

| Item | Result |
|---|---|
| All P1 screens pass A–H | **Not met** — H now passes; **C is the remaining blocker** (no assistive-technology testing). |
| `design-decisions.md` updated for every deviation | **Met** — `DECISIONS.md` carries 49 entries. |
| Tokens generated from one source | **Met** |
| Lint rules active: no raw design values; no warm token under admin | **Partly met** — the first is enforced by the token pipeline; **the warm-token lint rule is not written**. |
| Accessibility audit report attached | **Not met** |
| Pilot readiness reviewed against ROADMAP Phase 2 exit criteria | **This document** |

---

## What must be resolved before a real pilot

1. **Accessibility testing** — screen reader, keyboard-only, contrast,
   colour-blindness, forced-colors, 200% zoom. Built to spec, untested.
2. **Retention and data rights** — windows agreed, export and deletion
   workflows built (Constitution §7).
3. **Support access** — built (docs/md/SUPPORT-ACCESS.md); have the
   drafted Terms and Privacy wording reviewed and published before it is
   used on real companies.
4. **Backup restore rehearsal** (OPERATIONS.md).
5. **Payroll rules reviewed** by a qualified local professional.

*Resolved 9 August 2026:* the offline queue now persists (section H).
