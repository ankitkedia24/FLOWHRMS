# Flowacord support access

Version 1.1 · 1 October 2026 · Owner decision D-PL-03 · Built; **real companies locked until the v3 Terms are reviewed and published** (prepared on branch `legal/support-terms`).

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
- **After the v3 Terms are published** (below): any active company whose Owner has accepted v3 — a later change of their optional choices still counts; a withdrawal doesn't. Everyone is asked to accept a new version at their next sign-in (the consent gate), so this opens company by company without anyone doing anything else.
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

## The Terms that unlock real companies

Version 3 of the company terms ("Registering a company on FlowHRMS"), the Terms of Service and the Privacy Policy is **prepared on the branch `legal/support-terms` and not merged**: the live site refuses sign-ups when its built-in text and the published text differ, so the code and the publishing must go together. The wording for the lawyer, with each paragraph as it reads today and as proposed, is `docs/md/LEGAL-REVIEW-SUPPORT-TERMS.md`; the exact text is `SUPPORT_SENTENCES` in `src/lib/consent/documents.ts` (a test keeps the two identical). The same branch sets `SUPPORT_TERMS_VERSION = 3`.

## Publishing (after the lawyer approves)

1. If the lawyer changes the wording, change `SUPPORT_SENTENCES` and the review document on the branch, and run the tests.
2. Fetch both remotes and merge `main` into `legal/support-terms`; run all tests and the build.
3. `npm run publish-notices --workspace=@flowhrms/web -- --dry-run` should list exactly customer_terms v3, terms v3 and privacy v3.
4. Publish **and keep the v2 versions published** until the new build is live (the notice publish bridge): run `npm run publish-notices --workspace=@flowhrms/web`, then set customer_terms v2, terms v2 and privacy v2 back to PUBLISHED. Otherwise sign-ups fail on the old build.
5. Merge to `main`, push to both remotes, and watch Hostinger deploy. Check /terms and /privacy show the new sentence.
6. Retire the v2 versions.
7. Each owner is asked to accept the new version at their next sign-in; employees are not asked anything. A company opens for support once its owner has accepted.
