# FlowHRMS mobile — Open Decisions for the owner

These are business or product decisions the audit cannot make. §1–§5 block Phase 1; the rest can be answered later. Nothing is built until these are answered.

## 1. Background (field-force) location tracking — do we want it at all?

Today FlowHRMS promises employees "location only at the moment you check in and check out, never continuously" (employee notice v2) and markets GPS Tracking as "not continuous tracking". Background tracking reverses that promise for the companies that switch it on.
- **Option A:** Do not build it. Meet the "customer visits" need with **visit taps** (going out / reached customer / back at office), which need no background tracking.
- **Option B:** Build visit taps now, decide on background tracking after seeing demand.
- **Option C:** Commit to background tracking (Phase 5) with the safeguards in the geolocation plan, and accept the policy, review and consent work.
Recommendation: **B**.

## 2. Which background-location plugin, if §1 = C

- Community plugin (free) first, or Transistorsoft (commercial licence, per app) from the start? Recommendation: community first on Android, upgrade only if battery or gaps prove unacceptable.

## 3. Identity and accounts

- Application / bundle id `com.flowacord.flowhrms` — confirm.
- Google Play developer account and Apple Developer Program in **Flowacord's** name (organisation), not a personal account; who holds the credentials, the upload keystore and the Apple certificates.

## 4. Mac access for iOS

- Buy a Mac mini, rent a cloud Mac, or use CI-only macOS builds? A physical Mac is still needed for device debugging. Recommendation: CI builds (Codemagic or GitHub Actions) plus one Mac mini when iOS work starts.

## 5. The remote-loaded shell — accept its trade-offs

The recommended shell loads the live site. Accept that: the app needs network to start (like today's PWA); a site outage is an app outage; Apple may question a web-loaded app unless native features are visible. The alternative — a bundled static app with a separate API — is a rewrite of the data layer and is not recommended now. Confirm the remote-loaded approach.

## 6. Push notifications

- Which events push: approvals waiting, invitation accepted, leave decision, task assigned, check-out reminder, payslip ready? Quiet hours? Per-person opt-in only (recommended).

## 7. What the app opens to

- Sign-in (then home/admin), never the marketing site — confirm. Should the marketing "Start free trial" exist inside the app at all? (Apple dislikes sign-up for paid services that bypass in-app purchase; recommendation: no sign-up in the app, sign-in only, with a link to the website.)

## 8. Biometric unlock

- Wanted in v1? It is a local convenience in front of the existing session, not a security boundary. Recommendation: later (Phase 6 or after).

## 9. Paying for the subscription inside the iOS app

Apple's rules require in-app purchase for digital services sold to the app user, with an exception for services sold to organisations for their employees (guideline 3.1.3). FlowHRMS is bought by the company owner, who is also an app user, so the exception is arguable but not guaranteed.
- **Option A (safe):** On iOS, hide the Pay button; show "Manage your plan on the web". Android keeps Razorpay.
- **Option B:** Keep Razorpay on iOS and argue the enterprise exception in review notes; risk of rejection and rework.
Recommendation: **A**.

## 10. Minimum supported OS versions

- Android 8 (API 26) and iOS 15 are proposed floors. Do pilot customers have older phones?

## 11. Offline cold start

- Is "the app must open with no signal" a requirement for any customer? If yes, that changes the shell decision (§5) later; the saved-work queue already survives.

## 12. Who tests

- Which pilot companies and how many field staff will test the Android build for two weeks (Phase 3/7), and who at Flowacord owns the test devices?
