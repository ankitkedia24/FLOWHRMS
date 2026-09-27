# FlowHRMS — DPDP compliance note

Status: **Implemented 27 Sept 2026. Legal texts are in-house drafts pending review by a lawyer.**
Law: Digital Personal Data Protection Act, 2023 ("Act") and DPDP Rules, 2025 ("Rules"), notified 13 Nov 2025. Notice, consent and rights obligations apply from **13 May 2027**; FlowHRMS meets them now.

## Roles

| Data | Data Fiduciary | Flowacord's role |
|---|---|---|
| A registrant's own details (name, email, mobile, role, company profile, sign-up IP/device) | Flowacord | Fiduciary |
| Employees' work records (attendance, check-in/out location, leave, tasks, pay, documents) | The customer company | Data Processor, on the company's instructions (Terms §5) |

## What people see and agree to

Source: `src/lib/consent/documents.ts`. Published copies with sha256 fingerprints are in `consent_notices`, viewable at `/privacy/notice/[key]`, `/terms`, `/privacy`.

| Notice | Shown | Required purposes | Optional |
|---|---|---|---|
| `account_holder` — Privacy notice for your account | Trial sign-up (`/start` step 4); operator-created owners at invitation | Run the account and trial; security, legal and proof of consent | Product updates |
| `customer_terms` — Registering a company | Same | 18+; authorised to register; accepts Terms & Privacy Policy; company is Fiduciary for employee data | — |
| `employee` — Notice to employees | Invitation acceptance (`/invite/[token]`) | Work records for attendance/leave/tasks/pay/HR; **location only at check-in/out** (separate box) | — |

Rule 3 checklist, for each notice:
- It stands on its own and has its own page.
- It lists the personal data item by item, with a purpose for each.
- It describes the service.
- It explains how to withdraw consent, use your rights, and complain to the Data Protection Board.

Act s.6(1) — consent is a clear affirmative act for each purpose:
- One box per purpose, none pre-ticked.
- Only boxes the person ticked count; this is enforced on the server.
- Optional purposes are labelled optional.

## Enforcement

- `requireSession()` (`src/lib/authz/guard.ts`) sends anyone without current consent to `/consent`. It covers existing users, re-consent after a new notice version, and sign-in after withdrawal.
- Sign-up writes the company and both consents in one transaction. Neither exists without the other.
- Invitation acceptance refuses to set a password until the notice boxes are ticked.

## Proof (Act s.6(10): the burden of proof is on the Fiduciary)

`consent_records` is append-only. A Postgres trigger refuses UPDATE, DELETE and TRUNCATE (migration `20260927120000_consent_records`). Each record holds:
- who (user, email, company);
- what (notice key, version, sha256 of the exact text, and the linked Terms/Privacy versions);
- each choice;
- when (server time);
- how (method);
- where from (IP address and user agent);
- `prevHash` and `recordHash`, which form a hash chain. Any altered or removed record breaks the chain visibly (`verifyChain`, checked on every visit to `/platform/consents`).

Records have no foreign keys, so they survive account or company deletion. `purgeTenant` never touches them.

The platform area can:
- search records;
- show a printable consent certificate per record, with integrity checks;
- export CSV or JSON, including the hashes, for independent verification.

## Rights (Act ss. 11–14)

Account → Privacy & consent (`/account/privacy`) lets a person:
- see what they agreed to, and when;
- change the optional choice;
- **withdraw consent in one click**, which signs them out and opens a withdrawal/erasure request;
- ask for a summary of their data, a correction or an erasure;
- raise a grievance.

Requests land in `/platform/data-requests` with a **90-day** answer date (Rule 14). They are also emailed to help@. Closing a request requires recording what was done.

The same controls are available on the "Trial ended" screen, because rights do not pause with a trial.

## Children (Act s.9)

- Registrants confirm they are 18 or older.
- The Terms and the employee notice forbid adding under-18s without verifiable parental consent.

## Items for the lawyer

1. Review all five texts in `documents.ts`. After approval, press "Mark reviewed" in `/platform/notices`. Any wording change needs a new `version` and `npm run publish-notices`; everyone then re-consents.
2. Retention periods:
   - Account data: 90 days after closure.
   - Consent proof: "as long as needed".
   - Logs: at least 1 year.
3. The Terms' liability cap and governing law ("courts in India").
4. The employee notice relies on consent *and* on the s.7(i) employment legitimate use. Confirm the wording.
5. Data Protection Board complaint route: the notices point to MeitY (meity.gov.in). Replace this with the Board's own portal once it is officially confirmed.
6. Language (s.6(3)): the notices are in English only. Add Hindi (or others) as new language versions.
7. Grievance contact is currently help@flowacord.com / +91 89088 88880. Consider a named Grievance Officer and a dedicated address.
