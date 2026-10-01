# FlowHRMS — proposed wording on Flowacord support access

**For legal review · prepared 1 October 2026 · not yet published**

## Background

FlowHRMS is an HR and attendance service. Each customer company enters its employees' data; the company is the **Data Fiduciary** for that data under the Digital Personal Data Protection Act, 2023, and Flowacord is its **Data Processor**.

Flowacord has built a way for its staff to work inside a customer's account to help them — the customer's employee records, attendance, leave and payroll — and to change data where needed. During the product's early period companies need a lot of help, and Flowacord also wants to see how the product is really used to improve it.

How it works today, in the product:

- Only named Flowacord platform administrators can open a company's account this way.
- Every session is recorded by Flowacord: who, which company, when it was opened and closed.
- Every change made is recorded in the company's own activity log as **"Flowacord support"** — never under one of the company's own people.
- The company is not shown a banner or notified when a session starts.
- **It cannot be used on any real company until the wording below is published and that company's owner has accepted it.** Owners are asked to accept the new version the next time they sign in.

The current published texts say Flowacord processes employees' data "only on your company's instructions". The proposal makes support access one of those instructions, in three documents. Nothing else in them changes.

## 1. "Registering a company on FlowHRMS" (accepted by each company's owner) — version 2 → 3

**Section: "Who is responsible for employees' data", first paragraph.**

Current ending:

> … For that data your company is the Data Fiduciary under the Digital Personal Data Protection Act, 2023. Flowacord processes it only on your company's instructions, as its Data Processor, under the Terms of Service.

Proposed — the same, followed by:

> Those instructions include giving support: named Flowacord staff may open your company's FlowHRMS account to help you, fix problems, and maintain and improve the service, and may change your company's data where that is needed. Each time they do is recorded, and changes they make appear in your company's activity log as "Flowacord support".

**The box the owner must tick** — current:

> I understand that my company is responsible (as Data Fiduciary) for its employees' personal data in FlowHRMS, and that Flowacord processes it on the company's instructions.

Proposed:

> I understand that my company is responsible (as Data Fiduciary) for its employees' personal data in FlowHRMS, and that Flowacord processes it on the company's instructions, including giving support as described above.

## 2. Terms of Service — version 2 → 3

**Section 5, "Personal data".** Current:

> For employees' personal data your company is the Data Fiduciary and Flowacord is its Data Processor: we process that data only to provide the service, on your company's instructions, keep it secure, use sub-processors (hosting, database, email) under contract, help your company respond to employees' requests, and tell your company without undue delay if we become aware of a personal data breach affecting it. For your own account data Flowacord is the Data Fiduciary, as described in the Privacy Policy.

Proposed — inserted before the last sentence ("For your own account data …"):

> Your company's instructions include giving support: named Flowacord staff may access your company's data, and change it where needed, to support you, fix problems, and maintain and improve FlowHRMS. Each access is recorded, and changes appear in your company's activity log as "Flowacord support".

## 3. Privacy Policy — version 2 → 3

**Section 3, "Why, and on what basis".** Current first sentence:

> We process personal data to provide and secure FlowHRMS, to support customers, and to meet legal obligations.

Proposed — followed by:

> Named Flowacord staff may access a customer company's data to support that company and to maintain and improve FlowHRMS; each access is recorded, and any change they make is shown to the company as "Flowacord support".

## Not changed

- The notice shown to **employees** when they activate their account (so employees are not asked to accept anything new).
- The account-holder notice, and every other section of the three documents above — including the Privacy Policy's "least-privilege access for our staff, and logging of security-relevant events".

## Questions for you

1. Is "to maintain and improve the service" acceptable as part of the company's instructions to its Data Processor, or should product improvement be limited (for example, to aggregated or de-identified use) or set out as a separate purpose?
2. Should the employee notice also mention that Flowacord staff may access their records to support their employer?
3. The company is not notified when a session starts; changes are visible in its activity log, and Flowacord keeps a log of sessions. Is that sufficient, or should a company be able to see the session log itself, or be told when a session starts?
4. Is the owner's tick (on behalf of the company, as its authorised person) an adequate instruction from the Data Fiduciary for this access?
5. Anything you would change in the wording itself.

---

*For Flowacord, after approval:* `docs/md/SUPPORT-ACCESS.md` → Publishing. If the wording changes, the branch `legal/support-terms` is updated to match before publishing.
