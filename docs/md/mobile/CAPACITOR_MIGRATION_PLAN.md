# FlowHRMS — Capacitor Migration Plan

Audit date 28 Sept 2026. Phases adjusted to the actual repository. Each phase ends with a review; none starts before the previous one is accepted. **Phase 0 is complete with this document set; nothing else has begun.**

Guiding rules (from the brief, confirmed against the code): no rewrite of working modules; TypeScript stays primary; one backend; web deployment never breaks; the database changes only where a phase demonstrably needs it (Phase 5 and 6 only); no background-location hacks; platform code behind interfaces.

## Phase 0 — Audit and decisions (done: this folder)

Deliverables: the eight documents in `docs/md/mobile/`. Exit: owner answers `OPEN_DECISIONS.md` §1–§5 (the rest can wait).

## Phase 1 — Capacitor foundation, no behaviour change (web only)

Scope, all in the web codebase, deployable to the site without any app:
- `src/lib/platform/` service layer: `LocationService`, `CameraService`, `ShareService` (open/save/share), `NotificationService` (push/local — stub), `AppLifecycleService` (back, resume, network), each with a **web implementation identical to today's behaviour**.
- `AttendanceActionCard`, `LocationPicker`, `FileUpload`, `PhotoPicker`, `DocumentsPanel`, `ReceiptLink`, the two `PrintButton`s and the `ExternalLink` cases call the services. Tests cover the web implementations (pure logic already tested; add service tests).
- `@capacitor/core` added; `Capacitor.isNativePlatform()` gates the native implementations (all no-ops until Phase 2). `[data-native]` attribute on `<html>` set from the bridge.
- Password-reset flow moved to `token_hash` recovery links (fixes the existing cross-browser bug).
- `capacitor.config.ts`, `mobile/www/offline.html`, static icon/splash sources, `.well-known/assetlinks.json` and `apple-app-site-association` served by the site (empty fingerprints until keys exist).
- Exit: full test suite green, web behaviour unchanged (browser check on check-in, uploads, print, links), deployed.
- Effort: **M–L** (about a week).

## Phase 2 — Android shell and basic device testing

- `npx cap add android`; App, SplashScreen, StatusBar, Network, Keyboard, Browser, Device plugins; back-button handling; resume → sync/refresh; status bar; `errorPath`.
- Debug APK on 3+ real phones: sign-in/out, cookie persistence after force-quit and overnight, every employee screen, every admin screen at phone width, Razorpay checkout (Android UPI hand-off), Google Maps picker, keyboard over sheets, offline cold start page.
- Exit: a punch list of UX gaps from `MOBILE_UX_GAP_ANALYSIS.md` triaged; no data changes.
- Effort: **M** plus testing time.

## Phase 3 — Camera, files, share, deep links, native lifecycle

- Camera plugin behind `CameraService` (web keeps the file input); Filesystem + Share for CSV export and file viewing; server-side PDF for invoice, consent certificate and ID cards with Share on native (web keeps `window.print`).
- App Links live (fingerprints published); `/invite`, `/verify-email`, `/reset`, invoice links open in the app.
- `[data-native]` CSS polish (tap highlight, overscroll), external links via Browser.
- Exit: field test with one pilot company's staff on Android for two weeks.
- Effort: **L**.

## Phase 4 — Reliable foreground attendance location

- `@capacitor/geolocation` native implementation of `LocationService`; permission rationale sheet; "open settings" when denied; approximate-only handling. `computeCheckInState` and the server action untouched.
- Device tests: office edge, indoors, location off, airplane mode, prompt-backgrounded case, offline queue with coordinates.
- Exit: check-in success rate and accuracy compared with the browser version on the same phones.
- Effort: **M**.

## Phase 5 — Background field-force tracking (only if approved in `OPEN_DECISIONS.md` §1)

- Product and legal first: employee notice v3 with the optional tracking purpose; company switch on `GPS_TRACKING`; per-employee enrolment; work-hours window; retention setting; `attendance.track_view` permission; audit.
- Data: `LocationTrack`, `TrackingEnrolment` (additive migration, RLS, purge job).
- Plugin: `@capacitor-community/background-geolocation` on Android first; battery and gap measurement over a week; Transistorsoft if needed; iOS after Android is stable.
- Play location declaration and Apple review preparation.
- Exit: legal sign-off on the notice, pilot with consenting field staff, retention job verified.
- Effort: **L–XL**.

Recommended alternative to run *before* Phase 5: **visit taps** (going out / reached customer / back at office, foreground fixes) — a normal product feature on web and app, no background tracking, no new consent purpose beyond the notice wording. Not started (owner asked to wait).

## Phase 6 — Push notifications and mobile polish

- `@capacitor/push-notifications` with FCM (Android) and APNs (iOS); `device_tokens` table (additive); a sender in `src/lib/notifications` triggered where in-app notifications are created today; per-person opt-in; deep-link on tap.
- Local notification for the check-out reminder at shift end.
- Biometric unlock if wanted (§8), badge count, remaining UX gaps.
- Effort: **L**.

## Phase 7 — Android internal APK/AAB testing

- Signed release AAB, Play internal testing track with Flowacord staff, then closed testing with two pilot companies; Data safety form; crash and ANR review in Play vitals.
- Effort: **S–M** plus the testing window.

## Phase 8 — iOS and TestFlight

- Mac/CI in place (§4); `npx cap add ios`; the same plugins; Universal Links; Info.plist strings; the iOS-specific payments decision (§9) applied; TestFlight internal then external.
- Effort: **M–L**, dominated by environment setup and review cycles.

## Phase 9 — Store readiness and production rollout

- Listings, screenshots, privacy labels, review notes and demo accounts; DPDP alignment of store disclosures with the published notices; support page for "install the app"; in-app "update available" using the shell version header.
- Production on Play; App Store submission; monitor vitals and reviews for the first weeks; keep the PWA/web path as the fallback for anyone who cannot install.

## Timeline (indicative, one developer, sequential)

Phase 1: 1 week · Phase 2: 1 week + 2 weeks field testing overlap · Phase 3: 2 weeks · Phase 4: 1 week · Phase 6: 2 weeks · Phase 7: 1–2 weeks · Phase 8: 2–3 weeks (plus Apple account lead time) · Phase 9: 1–2 weeks. Phase 5 is separate and decision-dependent (3–5 weeks if approved).

Android in customers' hands (Phase 7) is realistic in **about 6–8 weeks** from a go-ahead; iOS **4–6 weeks after** that, mostly waiting on accounts, hardware and review.
