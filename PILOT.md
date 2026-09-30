# Running an FlowHRMS pilot

Notes for the first company to use FlowHRMS for real. Written to be handed to
the owner or admin, not kept internal.

## Before day one

**1. Set up your company**
- Company settings → name and timezone.
- Locations: add every place people work. Give each one coordinates so
  check-ins can be matched to it, and a permitted-area radius — a
  warehouse yard needs more room than a shop counter. Leave the radius
  blank to use the company default.
- Shifts: set start and end times, and the grace period. Grace is
  inclusive — arriving at exactly 10 minutes past is not late.
- Attendance & pay rules: decide whether repeated lateness and unmarked
  absence reduce pay. **These change what people are paid**, so agree them
  with whoever runs payroll before anyone checks in.

**2. Add your people**
- Employees → each person gets a home location, a shift and a role.
- Tick **"Works across locations"** for delivery, field and relief staff.
  Without it, checking in at another location is sent to you for approval
  — which is correct for a shop assistant and wrong for a driver.
- Roles decide what someone can see. Salary and bank details need their
  own permission on top.

**3. Decide what you are piloting**
Turn off modules you are not testing (Module Management). Turning one off
removes it from everyone's app and stops its notifications; no data is
deleted and you can turn it back on.

## The daily loop

- **Employees** check in from their phone. If they are away from a
  permitted area they can still check in — they give a reason, and it
  comes to you.
- **You** review exceptions each morning. Approving marks the day Present
  with no payroll change. Rejecting needs a reason, which the employee
  sees word for word.
- **Tasks** can require a photo or file before they can be closed.
- **Leave** shows its effect on pay before anyone decides.

## Payroll — read this properly

FlowHRMS does **not** calculate statutory amounts. It does not know your PF,
ESI, professional tax or TDS rates and will never invent them.

What you do: define your own salary components (Payroll → Salary
structures) using the figures **your accountant gives you**, and mark
those as accountant-defined. FlowHRMS then turns attendance and approved leave
into a payslip where every line shows how it was reached.

Approving a month **locks** it. After that, money changes only through a
recorded adjustment — nothing is quietly overwritten. You must confirm you
have checked the figures with your accountant before you can approve.

**FlowHRMS does not certify statutory compliance.** Have a qualified local
professional review your rules before you pay anyone from it.

## What to watch for in week one

- Do check-ins match the right location? If people are constantly sent
  for approval, your radius is too small or someone needs the roaming tick.
- Are exceptions being reviewed daily? They are the point of the system.
- Does the payroll preview match what you would have paid by hand? Compare
  one month before trusting it.
- Is anyone confused by wording? Tell us — the copy is meant to be plain.

## What is deliberately not here

Biometric or face attendance, continuous location tracking, a visitor
register, bank transfers, accounting integrations, a holiday calendar and
earned-leave balances. These were excluded on purpose, not forgotten.

## Working without signal

Warehouses and delivery routes lose signal. FlowHRMS is built for that:

- Checking in, checking out, requesting leave and sending task proof all
  work with no connection. A bar at the top says "No internet — working
  offline", and each saved item shows **Waiting to send**.
- The work is kept on the phone, so **closing the app does not lose it**.
- It is sent automatically when signal returns, and the person sees one
  message: "2 items sent."
- **The time recorded is when they tapped, not when the phone found
  signal.** Someone who checks in at 9 am and reaches signal at 5 pm is
  recorded as 9 am, and is not marked late for the delay. These records
  are marked as taken offline so you can see which they are.
- If a day somehow ends up with two different check-in times, the one
  already saved stands and you are shown both to decide.

Two things to tell your team: a phone with the **wrong date or time** will
have its check-in refused with a message explaining why, and **signing out
with unsent work** will warn them first — they should send it before
signing out.

Approvals, payroll and settings deliberately need a connection. FlowHRMS will
not accept a decision it cannot guarantee.

## Not ready yet

- Scheduled daily summaries by email or WhatsApp (needs a provider).
- Phone sign-in with an OTP (needs an SMS provider; today it is email).
- Company logo upload.
- Support access to your data. Flowacord support can open your company's
  records only after you accept updated Terms that allow it; until then
  nobody at FlowHRMS can open them from the product. When they can, every
  change they make shows in your activity log as "Flowacord support".

## Getting help

Tell your FlowHRMS contact what you saw, what you expected, and the time it
happened. Every approval and configuration change is in Activity log with
who did it and why, which usually answers the question quickly.
