# FlowHRMS — Expenses

Version: 1.4  |  Date: 30 September 2026  |  Status: **Approved** (owner, 4 September 2026; v1.1 added employee withdrawal to E1) · **E1 built, verified and deployed** (4 September 2026; §19 records the three deviations the owner accepted at verification) · **E2 built and verified** (8 September 2026; §13 carries the whole-rupee decision the owner took at the readiness review) · **v1.4** (30 September 2026, owner decision): only the Owner may decide or settle their own claim; the "allow self-approval" rule was removed (invariant 9, USER-ROLES.md Amendment 5).

MODULES.md admits Expenses in one clause: *"Expenses … may be enabled per tenant only when their detailed rules are approved."* The catalog carries the module already (`EXPENSES`, optional, sort order 110) with the placeholder description *"enabled only after its rules are approved."* This document is those rules.

The owner's architectural direction, which everything below obeys: **FlowHRMS stays practical and SaaS-configurable rather than accumulating hard-coded business rules.** Every number, threshold and preference in this module is tenant policy. The code enforces the shape; the tenant supplies the values.

---

## 1. Principles

1. **Expenses does not depend on Payroll.** A tenant with `EXPENSES = ON` and `PAYROLL = OFF` can submit, approve and settle claims. Payroll is a settlement *route* the module offers when — and only when — the Payroll module is enabled for that tenant. It is a runtime capability, never an import-time dependency.
2. **FlowHRMS records money; it never moves it.** Settlement is a recorded fact ("paid by cash on 12 Sept, voucher 118" or "adjustment on September payroll"), not a transfer. No bank integration, no payment execution — the same boundary Payroll already holds (D-019).
3. **The state machine is the only way status changes.** No screen, action or script sets a claim's status directly. One transition function owns every change, refuses anything not on the diagram, and writes the transition record before the status.
4. **Every transition is recorded**: who, when, previous state, new state, reason. Reasons are mandatory for rejection and partial approval, and the employee reads them word for word (Constitution §4).
5. **Warnings inform, they never decide.** A late claim, an over-cap claim, a probable duplicate — each is a fact placed in front of the approver. Nothing auto-rejects. Same reason Attendance confirms exceptions rather than punishing them.
6. **Receipts are private documents.** Private bucket, short-lived signed URLs, every view audited — the model employee documents already use (Constitution §7).
7. **Expenses never earn points.** Performance points come only from attendance and task evidence (PERFORMANCE-MODULE.md principle 1). Making spend scoreable would be the wrong incentive.
8. **Nothing here asserts compliance.** No GST treatment, no tax classification, no statutory reimbursement rules. The retention floor is a platform default, not legal advice (D-019 wording applies).

---

## 2. Functional scope

**What an employee does**
- Sees the categories the company allows, and for each whether a receipt is required.
- Submits a claim: category, amount (₹, paise allowed), expense date, short description, receipt(s) where required or wanted.
- Sees their own claim history with status, the decision reason where one exists, and settlement details once settled.
- Withdraws a claim that has not been decided yet, after confirming; may give a reason.
- Is notified (bell) when a claim is approved, partially approved, rejected or settled.

**What an approver does**
- Sees an action tile for each submitted claim (existing tile system; new kind `EXPENSE_CLAIM`).
- Opens the claim: amount, category, date, description, receipts, the submitter, and every warning that applied at submission (late / over cap / possible duplicate).
- Approves in full, approves a lower amount with a reason, or rejects with a reason.
- Settles an approved claim: records the route (outside payroll, or payroll when available) and a reference.

**What an admin configures** (versioned tenant policy, §8)
- Categories with per-category receipt requirement and optional cap.
- Submission deadline (days after the expense date).
- Default settlement route.
- Receipt retention window.
- *(v1.4: there is no self-approval setting — only the Owner may decide their own claim.)*

**Where it lives**
- Employee: `/expenses` (history + submit), `/expenses/[id]`.
- Admin: `/admin/expenses` (queue + all claims), `/admin/expenses/[id]` (decision card), `/admin/settings/expenses` (policy editor, categories).
- Tiles: Home screen, existing `ActionTiles` surface.

---

## 3. State machine

```
DRAFT ──submit──> SUBMITTED ──approve (full)────> APPROVED ────────────settle──> SETTLED
                      │                                                             ▲
                      ├──approve (lower amount)──> PARTIALLY_APPROVED ──settle──────┘
                      │
                      ├──reject (reason)────────> REJECTED
                      │
                      └──withdraw (claimant)────> WITHDRAWN
```

Seven states, seven permitted transitions.

| From | To | Actor | Requires |
|---|---|---|---|
| DRAFT | SUBMITTED | claimant | validation passes (§10.1); receipt present if category requires it |
| SUBMITTED | APPROVED | holder of `expenses.approve`, not the claimant | `approvedAmount = claimedAmount` |
| SUBMITTED | PARTIALLY_APPROVED | holder of `expenses.approve`, not the claimant | `0 < approvedAmount < claimedAmount`, reason |
| SUBMITTED | REJECTED | holder of `expenses.approve`, not the claimant | reason |
| SUBMITTED | WITHDRAWN | **claimant only** | no decision exists yet; explicit confirmation; reason optional |
| APPROVED | SETTLED | holder of `expenses.approve` | settlement record (§12) |
| PARTIALLY_APPROVED | SETTLED | holder of `expenses.approve` | settlement record (§12) |

**E1 exposure.** `DRAFT` exists in the enum and the transition table from day one. E1 exposes no draft screen: the submit form creates the row and moves it to `SUBMITTED` inside one transaction, so a `DRAFT` row is never observable in E1. Drafts become a screen when offline capture reaches Expenses (Attendance already has the machinery). Nothing about the enum or the transition function changes then.

**Withdrawal.** The claimant — and only the claimant — can withdraw a claim while it is `SUBMITTED`. No permission grants this to anyone else; an approver who wants a claim gone rejects it with a reason. The screen asks for explicit confirmation ("Withdraw this claim? It cannot be reopened.") and offers an optional reason, stored in the claimant's words. Once any decision exists the door is closed: an approved, partially approved, rejected or settled claim cannot be withdrawn. `WITHDRAWN` is terminal — no reopening, no editing, no resubmission of the same row; a corrected claim is a new claim. Withdrawal resolves the pending `EXPENSE_CLAIM` tile for everyone (§11) and is recorded exactly like every other transition (§14).

**Not in the model, on purpose.** There is no un-reject, no un-withdraw and no un-settle. A record that has reached a terminal state stays there; correction is always a new claim.

---

## 4. State invariants

Enforced in the transition function and, where the database can express them, as constraints. A violated invariant is a refused transition, never a stored row. The transition function runs in a transaction that locks the claim row, so two transitions racing each other — a withdrawal and an approval in the same second — resolve to exactly one winner; the second sees the new status and is refused.

1. `claimedAmount > 0`.
2. `approvedAmount` is `null` in `DRAFT`, `SUBMITTED`, `REJECTED`, `WITHDRAWN`; non-null in `APPROVED`, `PARTIALLY_APPROVED`, `SETTLED`.
3. `0 < approvedAmount ≤ claimedAmount`. Approving more than claimed is refused.
4. `status = PARTIALLY_APPROVED ⇔ approvedAmount < claimedAmount` (among decided, unsettled claims). The status is *derived* from the amounts inside the transition — no caller chooses it.
5. `decisionReason` is non-null for `REJECTED` and `PARTIALLY_APPROVED`.
6. `REJECTED`, `WITHDRAWN` and `SETTLED` are terminal. No transition leaves them.
7. A claim has at most one `ExpenseSettlement`; a settlement's `payrollAdjustmentId`, when present, is unique across the tenant (one claim → at most one adjustment; one adjustment ← at most one claim).
8. `submittedAt`, `policyVersion` and `claimNumber` are set at the `DRAFT → SUBMITTED` transition and never change.
9. The claimant cannot be the decider or the settler, unless they are the tenant **Owner** (nobody sits above them). The Owner's own decision carries `selfApproved: true` on the transition and the audit event. No policy setting changes this. *(v1.4, 30 September 2026; before, a policy `allowSelfApproval` let any approver decide their own claim. A value stored by older rule versions is ignored.)*
10. Every status change has exactly one `ExpenseClaimTransition` row whose `toStatus` equals the new status, written in the same transaction.
11. Snapshots are immutable: `categoryName`, `receiptRequiredAtSubmission`, `maxClaimAmountAtSubmission`, the warning flags. A later category edit never rewrites what the approver saw.
12. Warning flags are computed once at submission from the policy version stamped on the claim, and stored — never recomputed on read.
13. `WITHDRAWN` is reachable only from `SUBMITTED` and only by the claimant (`actorUserId` = the claimant's `userId`; no permission substitutes). The transition sets `withdrawnAt`, stores the optional `withdrawalReason`, and leaves `decidedById`, `decidedAt`, `decisionReason` and `approvedAmount` null. A withdrawal attempted by anyone else, or on any other status, is refused.

---

## 5. Permissions

Two new permission keys. The catalog's header rule (*"do not add … permissions beyond those documents"*) is satisfied by MODULES.md **Amendment 3** (Appendix A), which this document proposes; the catalog comment cites it on landing.

| Key | Name | Sensitive | Grants |
|---|---|---|---|
| `expenses.approve` | Approve and settle expense claims | no | decide on any submitted claim in the tenant; record settlement; see all claims |
| `expenses.view` | View expense claims | no | see other employees' claims and receipts, read-only |

- **Own claims are always visible** to the claimant. No permission governs a person reading their own record.
- `expenses.approve` implies `expenses.view` in evaluation (an approver can read what they decide). Both keys stay separate in the catalog so a read-only supervisor is expressible.
- Category and policy management is `policy.edit` (existing), consistent with every other tenant policy.
- Neither key is marked sensitive. Salary is sensitive because it is personal; a reimbursed auto fare is a business record. The owner can flip this before E1 without any structural change.

**Deliberately not reused:** `employees.manage`. Performance borrowed it for reward hand-overs; the owner has ruled that approving spend is its own authority.

---

## 6. Roles (default templates)

| Role | `expenses.approve` | `expenses.view` | Note |
|---|---|---|---|
| Tenant Owner | ✓ | ✓ | owner holds every key by construction (`ALL_PERMISSION_KEYS`) |
| Tenant Super Admin | ✓ | ✓ | |
| Admin | ✓ | ✓ | |
| HR | ✓ | ✓ | |
| Manager | — | ✓ | can be granted `expenses.approve` per tenant through the existing role editor |
| Team Leader | — | — | can be granted either through the role editor |
| Employee | — | — | submits and reads own claims — no key needed |
| Viewer | — | — | claims carry receipts; not in read-only scope by default |

Grants beyond the template use the role/permission machinery that already exists. This module adds no new grant mechanism.

---

## 7. Feature flags

| Flag | Default | Phase | Meaning |
|---|---|---|---|
| module `EXPENSES` | off (optional module) | E1 | the whole module |
| `EXPENSES.advances` | off | E3 | expense advances and their recovery |

**Payroll settlement is not a flag.** It is derived: the `PAYROLL` route is offered iff `evaluateAccess({ module: "PAYROLL" })` allows it for the tenant at the moment of settlement. A flag would let a tenant enable a route that cannot work; derivation cannot.

**Collision to resolve before E3:** the catalog already declares `PAYROLL.advances` ("Advances", default off) with **no implementation behind it**. A salary advance (Payroll's concept) and an expense advance (money issued before a trip, recovered against claims) are different things. E3 gets its own `EXPENSES.advances`; whether `PAYROLL.advances` is retired, kept for a future salary-advance feature, or renamed is decided at E3.

**Module off.** Pages redirect (existing shell behaviour); actions refuse via `checkAccess`; `EXPENSE_CLAIM` tiles are not shown and their decide actions refuse; data is retained untouched. The disable confirmation shows the count of `SUBMITTED` claims waiting, in the existing impact-confirm pattern.

**Enabling (intentional platform behaviour).** Expenses is an OPTIONAL module: like every optional module it is switched on for a tenant by the FlowHRMS platform contact, not by the tenant’s own admin (`setModuleEnabledAction` refuses optional modules by design). The order is therefore *enable first, then the tenant publishes its rules*. There is deliberately no policy gate on enabling — it would deadlock, since the rules editor needs the module on. Until rules are published, employees see an empty state, submission is refused with a plain message, and approvers see a publish-first alert; the tile queue and the claim counter are never touched.

---

## 8. Tenant policy (`PolicyKey = "expenses"`)

Versioned like `attendance`, `leave`, `payroll`, `performance`. Publishing creates version *n+1* and retires *n*. **Every claim stamps the version current at submission**, so "was it late?", "was a receipt required?" and "what was the cap?" are answerable for any historical claim without reference to today's policy.

```ts
type ExpensesPolicy = {
  submissionDeadlineDays: number;      // default 30; ≥ 1; late = flagged, never refused
  defaultSettlementRoute: "PAYROLL" | "OUTSIDE"; // default "PAYROLL"; effective route falls back
                                                  // to OUTSIDE when Payroll is unavailable
  receiptRetentionYears: number;       // default 7; floor RECEIPT_RETENTION_FLOOR_YEARS (7) — upward only
  categories: Array<{
    key: string;                       // stable slug, never shown
    name: string;                      // shown
    receiptRequired: boolean;
    maxClaimAmount: number | null;     // rupees; null = no cap; over cap = flagged, never refused
    isActive: boolean;                 // retired categories stay for history, cannot be chosen
    sortOrder: number;
  }>;
};
```

**Normalisation** (`normalizeExpensesPolicy`) fills defaults for missing fields and clamps: deadline ≥ 1, retention ≥ floor, amounts ≥ 0, at least one active category before the rules can be published (§7 explains why enabling the module is not gated on this). A v1 document read by later code normalises cleanly — the same compatibility rule Performance keeps.

**Categories live in the policy, not in a table.** They are configuration, versioned with the rest; the claim snapshots `categoryKey` + `categoryName` + the two rules that applied. This is why there is no `ExpenseCategory` table in §9. (A table would need its own versioning to give the same guarantee.)

**Seed defaults offered on first enable** (editable, not imposed): Local travel (receipt optional) · Fuel (required) · Customer meals (required) · Site material (required) · Phone / data (optional) · Other (required).

**Retention floor.** `RECEIPT_RETENTION_FLOOR_YEARS = 7` is a platform constant. A tenant may set retention longer, never shorter. The settings screen states, in D-019's register, that the tenant's accountant confirms the legal minimum for their entity; FlowHRMS does not certify it. The sweep that acts on this window is E4 — E0–E3 only store and display the value.

---

## 9. Database / schema proposal

Prisma-style, for review. **Not a migration.** Five tables, two enums; all tenant-scoped, all added to `scripts/setup-rls.ts` (37 → 42 tables) in E1.

```prisma
enum ExpenseClaimStatus {
  DRAFT
  SUBMITTED
  APPROVED
  PARTIALLY_APPROVED
  REJECTED
  WITHDRAWN
  SETTLED
}

enum ExpenseSettlementRoute {
  PAYROLL
  OUTSIDE
}

/// One claim. Amounts in rupees with paise (Decimal 12,2), INR only.
/// Category and rules are SNAPSHOTS at submission (invariant 11).
model ExpenseClaim {
  id             String             @id @default(uuid()) @db.Uuid
  tenantId       String             @db.Uuid
  membershipId   String             @db.Uuid
  /// Per-tenant sequence assigned at submission; shown as EXP-000042.
  claimNumber    Int
  status         ExpenseClaimStatus @default(DRAFT)

  categoryKey    String
  categoryName   String
  receiptRequiredAtSubmission Boolean
  maxClaimAmountAtSubmission  Decimal? @db.Decimal(12, 2)

  claimedAmount  Decimal            @db.Decimal(12, 2)
  approvedAmount Decimal?           @db.Decimal(12, 2)
  expenseDate    DateTime           @db.Date
  description    String

  /// Facts for the approver, computed once at submission (invariant 12).
  isLate         Boolean            @default(false)
  isOverCap      Boolean            @default(false)
  isPossibleDuplicate Boolean       @default(false)

  submittedAt    DateTime?
  policyVersion  Int?
  decidedById    String?            @db.Uuid
  decidedAt      DateTime?
  /// Shown to the employee word for word.
  decisionReason String?
  settledAt      DateTime?
  /// Set by the claimant's own withdrawal (invariant 13); reason optional,
  /// in their words, visible to anyone who can see the claim.
  withdrawnAt    DateTime?
  withdrawalReason String?
  createdAt      DateTime           @default(now())
  updatedAt      DateTime           @updatedAt

  tenant      Tenant                   @relation(fields: [tenantId], references: [id])
  membership  TenantMembership         @relation(fields: [membershipId], references: [id])
  receipts    ExpenseReceipt[]
  transitions ExpenseClaimTransition[]
  settlement  ExpenseSettlement?

  @@unique([tenantId, claimNumber])
  @@index([tenantId, membershipId, status])
  @@index([tenantId, status, submittedAt])
  @@index([tenantId, expenseDate])
  @@map("expense_claims")
}

/// A receipt image or PDF. The file lives in the PRIVATE bucket
/// `expense-receipts`; only `path` is stored (pattern: ProofFile).
model ExpenseReceipt {
  id           String   @id @default(uuid()) @db.Uuid
  tenantId     String   @db.Uuid
  claimId      String   @db.Uuid
  path         String
  name         String
  mime         String
  sizeBytes    Int
  uploadedById String   @db.Uuid
  createdAt    DateTime @default(now())

  claim ExpenseClaim @relation(fields: [claimId], references: [id], onDelete: Cascade)

  @@index([tenantId, claimId])
  @@map("expense_receipts")
}

/// The claim's own history — who moved it, from what, to what, why.
/// Append-only by convention (no update path, no updatedAt), like AuditEvent.
model ExpenseClaimTransition {
  id             String             @id @default(uuid()) @db.Uuid
  tenantId       String             @db.Uuid
  claimId        String             @db.Uuid
  fromStatus     ExpenseClaimStatus?
  toStatus       ExpenseClaimStatus
  actorUserId    String?            @db.Uuid
  actorType      AuditActorType     @default(USER)
  reason         String?
  /// Amount decided at this step, when the step decides one.
  approvedAmount Decimal?           @db.Decimal(12, 2)
  selfApproved   Boolean            @default(false)
  createdAt      DateTime           @default(now())

  claim ExpenseClaim @relation(fields: [claimId], references: [id], onDelete: Cascade)

  @@index([tenantId, claimId, createdAt])
  @@map("expense_claim_transitions")
}

/// How an approved claim was paid — a RECORD, not a payment.
model ExpenseSettlement {
  id                  String                 @id @default(uuid()) @db.Uuid
  tenantId            String                 @db.Uuid
  claimId             String                 @unique @db.Uuid
  route               ExpenseSettlementRoute
  amount              Decimal                @db.Decimal(12, 2)
  /// OUTSIDE: free text ("cash 12 Sept, voucher 118"). PAYROLL: run month.
  reference           String?
  /// Set only for PAYROLL; unique so one adjustment settles one claim.
  payrollAdjustmentId String?                @unique @db.Uuid
  settledById         String                 @db.Uuid
  settledAt           DateTime               @default(now())

  claim ExpenseClaim @relation(fields: [claimId], references: [id])

  @@index([tenantId, settledAt])
  @@map("expense_settlements")
}

/// Per-tenant claim counter, incremented under the tenant advisory lock
/// inside the submit transaction (the pattern reward redemption uses).
model ExpenseCounter {
  tenantId String @id @db.Uuid
  next     Int    @default(1)
  @@map("expense_counters")
}
```

Relation lists to add: `Tenant.expenseClaims`, `TenantMembership.expenseClaims`. **No foreign key from `ExpenseSettlement` to `PayrollAdjustment`** — the id is stored, the constraint is uniqueness, and Payroll being absent or later disabled never breaks the row (principle 1). `PayrollAdjustment` gets nothing new; traceability is the adjustment's `label` and `reason` carrying the claim number.

E3 adds `expense_advances` and `expense_advance_recoveries`; E4 adds nothing structural.

---

## 10. Receipt / security model

Mirrors employee documents (`src/lib/employees/documents.ts`) exactly, because that model has already been reasoned about under Constitution §7.

- **Bucket** `expense-receipts`, private. Nothing is ever served from a public path.
- **Path** `{tenantId}/{claimId}/{receiptId}` — tenant prefix first, so bucket policies and any future per-tenant export are prefix operations.
- **Upload** from the browser straight into the private bucket, under `{tenantId}/{membershipId}/{draftId}/…`, exactly as task proof and employee documents already do: the bucket’s only storage policy is *insert for authenticated users* — nothing can be listed or read that way. The submit action then records only paths in the claimant’s own folder, and the same rule is checked again before a link is signed (`src/lib/storage/paths.ts`; hardening batch 3 added the person folder — before it, only the tenant prefix was checked), with a MIME allowlist (`image/jpeg`, `image/png`, `image/webp`, `image/heic`, `application/pdf`) and size ≤ 10 MB. *(v1.2: E0 said “through a server action”; E1 kept the codebase’s proven pattern — see §19.)*
- **Read** through a short-lived signed URL (TTL 120 s, matching documents and proofs), minted server-side with the service-role key — the bucket has no read policy for signed-in users — only for: the claimant; holders of `expenses.view`/`expenses.approve` in the same tenant. Every mint writes `expense.receipt_viewed` with viewer, claim and receipt ids.
- **No transformation.** No OCR, no thumbnailing that copies the file elsewhere. The image is displayed via the signed URL and nothing else.
- **Retention** is a policy value (§8) that E4 acts on. Until E4, no receipt is ever deleted by the system. Claim deletion is not a feature at any phase; purge (`purgeTenant`) cascades the five tables. Emptying the tenant’s bucket prefix is an E4 item alongside the retention sweep — no module’s purge touches storage today (§19).
- **Immutability.** Receipts cannot be replaced or removed after submission. A wrong receipt means a rejected claim and a new one.

### 10.1 Submission validation

Refuses (nothing is stored): amount ≤ 0 · amount with more than two decimals · expense date in the future · expense date before the person's joining date · category not active in the current policy · receipt required and none attached · description empty.

Flags (stored on the claim, shown to the approver, never refuse): `isLate` (submission more than `submissionDeadlineDays` after `expenseDate`) · `isOverCap` (amount above the category's cap) · `isPossibleDuplicate` (another claim by the same person, same category, same date, same amount, not `REJECTED` or `WITHDRAWN` — a withdrawn claim is the normal prelude to a corrected one, and must not shadow it).

---

## 11. Approval model

- **Queue.** Submission raises an `ActionRequest` of kind `EXPENSE_CLAIM` with `aboutMembershipId = claimant`. Audience is the existing rule: everyone holding the deciding permission, plus the claimant's department head if they hold it. `DECIDING_PERMISSION.EXPENSE_CLAIM = "expenses.approve"`.
- **Never inline.** `APPROVE_INLINE.EXPENSE_CLAIM = { allowed: false, because: "Approving means choosing the amount and where it settles." }` — the same reasoning that keeps leave and reward decisions off the one-tap path (integrity pattern 1). The tile links to `/admin/expenses/[id]`.
- **The decision card shows** the amount, category, date, description, receipts, submitter, the three warning flags with their meaning spelled out, the policy version's deadline and cap for that category, and any earlier claims that triggered the duplicate flag.
- **Three outcomes**, one form: *Approve* (full amount) · *Approve a different amount* (amount field + mandatory reason) · *Reject* (mandatory reason). The transition derives `APPROVED` vs `PARTIALLY_APPROVED` from the amounts (invariant 4).
- **Self-approval** is refused for everyone but the Owner (invariant 9, v1.4). The Owner's own decision carries `selfApproved: true` on the transition and audit event, and the card says so.
- **Single step.** One approver, one decision. Multi-level chains, amount-tiered approvers and delegation are non-goals (§18).
- **Resolution** resolves the tile for everyone; the employee gets a bell notification with the reason verbatim.
- **Withdrawal resolves the tile too.** `SUBMITTED → WITHDRAWN` resolves the `EXPENSE_CLAIM` request with resolution `withdrawn`; an approver who opens a stale link sees the claim's history and the claimant's reason, not a decision form. No notification goes to approvers — a withdrawn claim asks nothing of them.

---

## 12. Settlement model

Settlement is the transition `APPROVED | PARTIALLY_APPROVED → SETTLED`, and it requires an `ExpenseSettlement` row written in the same transaction.

**Route selection**

| Payroll module | Routes offered | Preselected |
|---|---|---|
| enabled | `PAYROLL`, `OUTSIDE` | policy `defaultSettlementRoute` |
| disabled | `OUTSIDE` only | `OUTSIDE` |

The settling screen computes this at render *and* the action recomputes it at write. A `PAYROLL` route requested while Payroll is disabled is refused with a plain message, never silently downgraded.

**`OUTSIDE`** — reference is free text, required, ≥ 3 characters (cash / UPI / bank, date, voucher). FlowHRMS records it and nothing else happens. This is the whole of E1's settlement.

**`PAYROLL`** — through the seam in §13; the adjustment id lands on the settlement row and the reference is the payroll month ("September 2026 payroll"). The claim page shows what payroll would do *before* the click — the target month and the rounded figure, or the typed refusal with its way out — and the payroll run screen offers the same settlement from its side (§13 rule 8).

**Amount** settled is `approvedAmount` for `OUTSIDE`. For `PAYROLL` it is `approvedAmount` **rounded to whole rupees** (§13 rule 5) — the same figure on the payslip line and on the settlement record, with the approved paise kept on the claim and the rounding stated wherever the settlement is shown. A settlement for any other amount is refused (the partial-approval step is where amounts change).

**History survives configuration.** The settlement row snapshots route and reference. Disabling Payroll later, or changing the default route, changes nothing that already happened.

---

## 13. Payroll integration contract (E2)

One seam, in `src/lib/expenses/settle-payroll.ts`, the only file in the Expenses module that imports from `@/lib/payroll`.

```ts
type PayrollSettlementResult =
  | { ok: true;  adjustmentId: string; periodMonth: Date }
  | { ok: false; reason: "PAYROLL_UNAVAILABLE" }   // module off for this tenant
  | { ok: false; reason: "NO_OPEN_RUN"; earliestLockedMonth?: Date }
  | { ok: false; reason: "NO_LINE_FOR_PERSON"; periodMonth: Date };

settleViaPayroll(session, claim): Promise<PayrollSettlementResult>
```

Rules the seam enforces:

1. **Entitlement first.** `evaluateAccess({ module: "PAYROLL" })` for the tenant; anything but allowed → `PAYROLL_UNAVAILABLE`. Returned, never thrown.
2. **Never onto an approved run.** Today `addAdjustmentAction` permits adjustments on `APPROVED` runs (Constitution §6: post-lock changes are auditable adjustments). Expenses does *not* use that door: an adjustment after payslips are delivered changes a figure someone has already read. The target is the **earliest `DRAFT` run whose `periodMonth ≥` the month of `decidedAt`**.
3. **Expenses never creates runs.** A run exists because Payroll calculated it, with an inputs snapshot. If no `DRAFT` run qualifies → `NO_OPEN_RUN`; the screen says "No payroll run is open for September yet — settle outside payroll, or come back once September is calculated." The claim stays `APPROVED`.
4. **The person must be on the run with a payable line.** No `PayrollLine` for the claimant on that run (joined mid-month, left), or a line with `NO_SALARY_STRUCTURE` (excluded at approval, its adjustments dropped from the totals) → `NO_LINE_FOR_PERSON`; same two choices offered. A `BLOCKED` line (negative net) is on the run — a reimbursement only helps it.
5. **Whole rupees, one figure on both sides** *(owner decision, 7 September 2026)*. Payroll works in whole rupees (`roundRupees`, half-up), so the seam writes `roundRupees(approvedAmount)` as the adjustment **and** as the settlement record’s `amount`; the claim keeps its approved paise, and every screen that shows the settlement states the rounding ("₹1,240.50 approved, rounded to ₹1,241.00 — payroll works in whole rupees"). Without this, the payslip and the expense record would carry two different truths for one payment. **Adjustment shape** — `label`: `Expense · {categoryName} · EXP-{claimNumber}`; `amount`: the rounded figure; `reason`: `Expense claim EXP-{claimNumber}, approved {date} by {name}`; `createdById`: the settler. Line and run totals are recomputed by Payroll’s own `recordAdjustment` (`src/lib/payroll/adjustments.ts`, extracted from `addAdjustmentAction` at E2 so it can run inside the settlement transaction) — the seam never re-implements payroll arithmetic.
6. **One-to-one.** `ExpenseSettlement.payrollAdjustmentId` is unique; the seam is idempotent per claim (a retry after a network failure finds the existing settlement and returns it).
7. **Payslip traceability** is the adjustment line itself: label and reason carry the claim number, so a payslip reader can find the claim and a claim reader can find the run. No new field on `PayrollAdjustment`.
8. **Payroll pulls, too (E2).** The run screen lists `APPROVED` claims for people on the run, with one-tap settle into it. Both directions use the same seam.

What is *not* in the contract: Expenses never reads salary, bank details or payslips; the seam receives a claim and returns an id. Neither `payroll.view` nor `payroll.edit` is required to settle — the settler learns nothing about pay, and `recordAdjustment` is deliberately permission-free so this boundary holds (its docblock says so; do not "fix" it).

**A guard Payroll gained at E2.** The run preview now lists *adjustments on lines the run will not pay* — a person whose salary structure was removed, or who left, after a settlement landed on their line. The run screen shows them as a warning naming the person, count and amount, so a reimbursement can never silently vanish from every payslip.

---

## 14. Audit requirements

Two records per state change, deliberately.

**`ExpenseClaimTransition`** (§9) — the claim's own timeline. Rendered to the employee as "what happened to my claim" and to auditors as the unbroken chain. Written first, in the transaction, before the status update.

**`AuditEvent`** — the tenant-wide compliance log the Activity screen already renders. `entityType: "expense_claim"`, `entityId: claim.id`, `before`/`after` carrying `{ status, approvedAmount }`, `reason` where one was given.

| Action key | When | Extra metadata |
|---|---|---|
| `expense.submitted` | DRAFT → SUBMITTED | claimNumber, amount, category, flags, policyVersion |
| `expense.approved` | → APPROVED | approvedAmount, selfApproved |
| `expense.partially_approved` | → PARTIALLY_APPROVED | claimed, approved, selfApproved |
| `expense.rejected` | → REJECTED | — (reason in `reason`) |
| `expense.withdrawn` | SUBMITTED → WITHDRAWN | claimNumber, amount; actor is the claimant; `reason` may be null |
| `expense.settled` | → SETTLED | route, reference, payrollAdjustmentId |
| `expense.receipt_uploaded` | receipt stored | receiptId, mime, sizeBytes |
| `expense.receipt_viewed` | signed URL minted | receiptId, viewer |
| `expense.policy_published` | policy version created | version, changed fields |

Rules: audit writes are in the same transaction as the change they describe; actor is the session user (or `SYSTEM` for E4's retention sweep); nothing here has an update path. Money in metadata is a number, never formatted; the Activity screen formats.

---

## 15. Module dependencies

```
MODULE_DEPENDENCIES: no entry for EXPENSES
```

| Uses | Kind | If absent |
|---|---|---|
| EMPLOYEES (core: memberships, departments) | core — always present | n/a |
| Action tiles, notifications, audit, policies | platform machinery, not modules | n/a |
| PAYROLL | **optional, runtime-checked** | `OUTSIDE` is the only settlement route |
| PERFORMANCE | none — no points from expenses | n/a |
| APPROVALS (optional module) | none — tiles are core, not that module | n/a |

The only import from `@/lib/payroll` anywhere under `src/lib/expenses/` is inside `settle-payroll.ts`. A test asserts this in E2 so the boundary cannot erode quietly.

---

## 16. E1–E4 boundaries

| Phase | In | Out (deferred to) |
|---|---|---|
| **E0** (this document) | model, schema, permissions, flags, policy, contracts, acceptance | any code |
| **E1 — Core** | migration + RLS; enum, transition function, invariants, pure-logic tests; `expenses` policy + normaliser + settings editor with categories; `expenses.approve`/`expenses.view` in catalog + role templates + Amendment 3; submit (submit-only, no drafts) with receipt upload + validation + flags; employee history + detail; `EXPENSE_CLAIM` tile kind; decision card (approve / partial / reject); **employee withdrawal** (confirmation, optional reason, tile resolution); `OUTSIDE` settlement; transitions + audit; bell notifications; module-off behaviour; purge cascade | payroll route (E2), advances (E3), reports/export/retention sweep (E4), drafts, department-scoped `expenses.view` |
| **E2 — Payroll integration** *(built 8 Sept 2026)* | `settle-payroll.ts` seam and all four results; whole-rupee rounding at the seam; route-aware `settleClaimAction` recomputing offered routes at write time; claim-page preview of what payroll would do; run screen "claims waiting to settle into this run" with one-tap settle; excluded-line adjustment warning; payslip traceability via label and reason; import-boundary test; integration suite (refusals write nothing, rounded settlement, no payroll permission, idempotency, recalculation keeps the adjustment, approval preview includes it) | anything that changes Payroll’s own lifecycle |
| **E3 — Advances** | `EXPENSES.advances` flag; advance issue (recorded, not paid); recovery schedule; outstanding balance on the claim and the person; recovery against claims; recovery through payroll via the §13 seam (negative adjustment); early settlement; the `PAYROLL.advances` collision decision | interest, salary advances |
| **E4 — Reporting & retention** | expense / category / employee / decision reports; outstanding advances; Excel + PDF export (`reports.export`); per-tenant data export; **receipt retention sweep** honouring `receiptRetentionYears` with a `SYSTEM` audit event per deletion — the first concrete answer to ACCEPTANCE.md's "retention honoured" line; **receipt storage purge** on tenant deletion (empty the `{tenantId}/` prefix of `expense-receipts` from `purgeTenant` — the storage half §10 defers) | analytics, budgets |

Each phase ships on its own: tests, typecheck, lint, build, browser at 360 px and 1280 px, commit, deploy.

---

## 17. Acceptance criteria

**State machine & invariants**
- [ ] Every transition not in §3 is refused with a message; a pure-logic test enumerates all **49** status pairs (7 × 7) and asserts exactly the **7** permitted.
- [ ] `PARTIALLY_APPROVED` cannot be requested; it results from `approvedAmount < claimedAmount`.
- [ ] Approving more than claimed, approving zero, and rejecting without a reason are refused.
- [ ] `REJECTED`, `WITHDRAWN` and `SETTLED` accept no transition.
- [ ] Self-approval is refused for everyone but the Owner; the Owner's is permitted and flagged (v1.4).
- [ ] Every status change has one transition row and one audit event in the same transaction; a failure in either rolls back the status.
- [ ] Two concurrent transitions on one claim (withdraw vs. approve) yield exactly one success; the other is refused with the claim's current status named.

**Withdrawal**
- [ ] The claimant can withdraw a `SUBMITTED` claim only after an explicit confirmation; the optional reason is stored verbatim when given.
- [ ] Withdrawal by anyone other than the claimant is refused — including a holder of `expenses.approve` and the tenant owner.
- [ ] Withdrawal of a claim in any status other than `SUBMITTED` is refused.
- [ ] Withdrawal writes one transition row (`actorType: USER`, actor = claimant) and one `expense.withdrawn` audit event, and resolves the pending `EXPENSE_CLAIM` tile with resolution `withdrawn`.
- [ ] A withdrawn claim cannot be edited, reopened or resubmitted; `withdrawnAt` is set and `decidedById`/`approvedAmount` remain null.
- [ ] A withdrawn claim never contributes to another claim's `isPossibleDuplicate` flag.
- [ ] The employee's history shows the withdrawn claim with its reason; approvers with `expenses.view` see the same.

**Independence**
- [ ] With `PAYROLL` disabled: submit → approve → settle `OUTSIDE` completes; no Payroll code path executes (proven by a test that mocks `@/lib/payroll` to throw).
- [ ] `EXPENSES` can be enabled with `PAYROLL` disabled; the module-management UI shows no dependency.
- [ ] Disabling `PAYROLL` after payroll settlements exist changes nothing on those settlement rows.

**Policy**
- [ ] Every value in §8 is editable, versioned, and stamped on claims at submission.
- [ ] A claim submitted under v1 still reports "late" by v1's deadline after v2 shortens it.
- [ ] Retention cannot be set below the floor; can be set above.
- [ ] A retired category cannot be chosen; old claims still show its name.

**Receipts**
- [ ] A required-receipt category refuses submission without one; an optional one accepts.
- [ ] Receipt URLs expire in 120 s; a second view mints a second audit event.
- [ ] A user without `expenses.view` who is not the claimant gets 404 on another person's receipt.

**Approval & settlement**
- [ ] Tiles reach only holders of `expenses.approve` (+ department head holding it).
- [ ] The decision card shows all three flags with plain-language meaning.
- [ ] Settlement route list matches the Payroll entitlement at write time, not just at render.
- [ ] `OUTSIDE` settlement requires a reference.

**Security & privacy**
- [ ] All five tables are in `scripts/setup-rls.ts`; cross-tenant read returns nothing.
- [ ] No salary, bank or payslip data is readable through any Expenses screen or action.
- [ ] `purgeTenant` cascades the five tables (the bucket prefix moves to E4, §19).

**Design system**
- [ ] Employee screens work from 360 px; status is text + colour; money figures render at final value (D-017).

---

## 18. Explicit non-goals

- Moving money: no payouts, UPI, bank files, or payment status from a bank.
- GST, TDS, tax classification, or any statutory treatment of an expense.
- Mileage rates, per-diem tables, city classes, or any policy engine beyond category + cap + receipt + deadline.
- OCR, receipt parsing, amount extraction, or merchant detection.
- Multi-currency. INR only.
- Card feeds, bank feeds, or corporate card reconciliation.
- Multi-level approval chains, amount-tiered approvers, delegation, or out-of-office routing.
- Budgets, cost centres, projects, or client billing.
- Editing a submitted claim. Reopening, editing or resubmitting a withdrawn claim.
- Withdrawal by anyone but the claimant, or of anything but a `SUBMITTED` claim.
- Draft screens or offline capture (E1).
- Department-scoped `expenses.view` (E1 is tenant-wide).
- Deleting claims. Deleting receipts before E4's retention sweep.
- Performance points for expenses. Ever.
- Salary advances. (E3 is expense advances; the salary concept stays Payroll's.)

---

## 19. Deviations recorded at E1 verification (v1.2)

Three places where the build differs from the E0 text. Each was reported at verification and accepted by the owner on 4 September 2026.

1. **Receipt upload is browser-to-bucket, not through a server action** (§10). The codebase’s two existing private-file flows — task proof and employee documents — upload from the browser under an insert-only storage policy and let the server record the path; E1 followed them. The properties §10 cares about hold unchanged: no public path, tenant-prefixed paths validated at submission, signed-URL reads only, every read audited. A server-side upload would have meant raising the app-wide server-action body limit for one module.
2. **Purge does not empty the receipt bucket prefix** (§10). No module’s purge touches storage today; E1 kept the same shape. Listed under E4 (§16) next to the retention sweep, which needs the same storage-deletion code.
3. **No policy gate on enabling the module** (§7, §8). Optional modules are enabled by the platform contact, so a gate on tenant-published rules would deadlock. The equivalent protection lives in the screens: empty state, refused submission, publish-first alert.

Also landed at E1, beyond this module: action tiles now carry their module for every kind, so a tile whose module is off is hidden and its decide action refuses — the enforcement §7 asked for, applied consistently.

**E2 (8 September 2026).** No deviation from §13 as amended. Two things worth knowing that the contract did not spell out: the seam accepts a `BLOCKED` (negative-net) line as "on the run", refusing only `NO_SALARY_STRUCTURE` and absent lines (rule 4); and `addAdjustmentAction` now runs inside a transaction — same inputs, same messages, same audit event, one difference in failure mode (all-or-nothing).

---

## Appendix A — Proposed MODULES.md Amendment 3

To be appended to MODULES.md on approval of this document, in the form Amendments 1 and 2 use:

> # Amendment 3 — Expenses: rules, permissions and payroll independence
>
> The Expenses module's detailed rules are EXPENSES-MODULE.md. It adds two permissions to USER-ROLES.md — `expenses.approve` (approve and settle claims; default Owner, Super Admin, Admin, HR) and `expenses.view` (see others' claims; default additionally Manager) — and one feature flag to FEATURE-FLAGS.md, `EXPENSES.advances` (default off). Expenses has no module dependency. Payroll is a settlement route offered only when the Payroll module is enabled for the tenant; a tenant without Payroll settles claims outside payroll. Claims never earn Performance points.

---

## Give this to Claude

*After* the owner approves this document:

> Project: FlowHRMS. Build **Expenses E1 — Core** exactly as EXPENSES-MODULE.md §16 lists it. Start with the migration, RLS entries, the state machine as a pure module with the 49-pair test, and the policy normaliser; then the submit path; then employee withdrawal; then the decision card; then `OUTSIDE` settlement. No payroll route, no advances, no reports. Land Amendment 3 in MODULES.md and cite it in the catalog header. Same verification as every phase: tests, typecheck, lint, build, browser at 360 and 1280, commit, deploy — then stop and report.
