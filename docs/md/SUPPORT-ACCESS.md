# Flowacord support access

Version 1.0 · 30 September 2026 · Owner decision D-PL-03 · Built; **real companies locked until the Terms below are reviewed and published.**

## What it is

A Flowacord platform admin can work inside a customer's company to help them: see what the Owner sees and change data where needed, for as long as it takes. It is for the development phase, when companies need a lot of help and Flowacord needs to see how the product is really used.

## How to use it

1. `/platform` → the company → **Support** → **Open as support**.
2. You land in the company's admin area with the **Owner's access**. A strip at the top — shown only to you — names the company and has **Exit support**.
3. Work as normal. Exit when done, or sign out; either closes the session. There is no time limit. Opening another company closes the one you were in.

## What the company sees

- **No banner, no notification, no email** when support opens their company.
- **Every change support makes is recorded as "Flowacord support"** — in their Activity log and anywhere a record says who did something ("Approved by Flowacord support"). It is never recorded under one of the company's own people.
- The support member itself is **hidden**: not in their employee list, headcount, billing count, payroll, reports, owner list, approver lists or notifications (`lib/db.ts`; a few relation counts filter it by hand).

## What Flowacord keeps

- Every session — who, which company, opened, closed — on **/platform/system**, which only platform admins see.
- Each support change also carries, in the company's audit record, which Flowacord person made it and in which session (not shown to the company).

## When a company can be opened

`lib/platform/support-policy.ts`:

- **Now:** only the placeholder (`demo-co`) and sample (`sunrise-traders-sample`) companies, which hold no real person's data.
- **After the Terms are published** (below): any active company whose Owner has accepted that version. Everyone is asked to accept a new version at their next sign-in (the consent gate), so this opens company by company without anyone doing anything else.
- Never a suspended company.

## How it works

| Piece | Where |
|---|---|
| A "Flowacord support" user per platform admin (`users.supportOfUserId`), no sign-in of its own | `lib/platform/support-actions.ts` |
| A hidden member of the company with status `SUPPORT` and the Owner role | same |
| `support_sessions`: who, company, member, opened, closed | Prisma `SupportSession` |
| The `fh_support` cookie (httpOnly) names the open session; `getAppSession()` turns it into the company session | `lib/auth/support.ts`, `lib/auth/session.ts` |
| The platform area always uses the admin's own session (`requirePlatformAdmin` → `getOwnSession`) | `lib/authz/guard.ts` |
| Support changes: actor = the support identity, `actorType` PLATFORM, metadata `supportSessionId`, `supportBy` | `lib/audit.ts` |
| Consent screens are skipped for support; support never consents for anyone and never records its own location | `lib/authz/guard.ts`, `lib/field-visits/service.ts` |

## Draft wording for the Terms and Privacy Policy — for legal review

**DRAFT — not published.** Today the published texts say Flowacord processes employees' data "only on your company's instructions" and give staff "least-privilege access". The additions below make support access one of those instructions. Publish only after the lawyer approves; then bump each document's `version` in `src/lib/consent/documents.ts`, run `npm run publish-notices` (keep the old versions published until Hostinger has deployed — see the notice publish bridge in OPERATIONS.md), and set `SUPPORT_TERMS_VERSION` in `support-policy.ts` to the new `customer_terms` version in the same change.

*Registering a company (`customer_terms` notice), after "…under the Terms of Service.":*

> Your company also instructs Flowacord to let named Flowacord staff open its FlowHRMS account to give support, fix problems, and maintain and improve the service, and to make changes to your company's data where that is needed. Each time they do is recorded, and changes they make appear in your company's activity log as "Flowacord support".

*Terms of Service, data-processing section, after "…on your company's instructions,":*

> including the instruction to give support: named Flowacord staff may access your company's data, and change it where needed, to support you, fix problems, and maintain and improve FlowHRMS. Access is recorded by Flowacord, and changes appear in your company's activity log as "Flowacord support".

*Privacy Policy, "How we use personal data":*

> Named Flowacord staff may access a customer company's data to support that company and to maintain and improve FlowHRMS. Each access is recorded, and any change they make is shown to the company as "Flowacord support".

*Questions for the lawyer:* whether improving the product needs its own purpose (or aggregated use only); whether the employee notice needs a line too; whether a change log on request is enough, or companies should be able to see sessions themselves.
