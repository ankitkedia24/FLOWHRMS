# FlowHRMS — Capacitor Readiness Audit

Status: **Audit only — 28 Sept 2026. No code changed, nothing installed.**
Repository state audited: `main` at `6fb03ce` (75 commits), 719 passing tests.
Companion documents: `MOBILE_COMPATIBILITY_MATRIX.md`, `GEOLOCATION_AND_BACKGROUND_TRACKING_PLAN.md`, `MOBILE_UX_GAP_ANALYSIS.md`, `ANDROID_RELEASE_PLAN.md`, `IOS_RELEASE_PLAN.md`, `CAPACITOR_MIGRATION_PLAN.md`, `OPEN_DECISIONS.md`.

## 1. Executive assessment

**Can FlowHRMS become an app-quality Android and iOS app without a rewrite? Yes — with one architectural choice made up front.**

FlowHRMS is a server-rendered Next.js 16 application: pages are React Server Components, every write is a Server Action (37 `"use server"` files), and routes are dynamic (`/invite/[token]`, `/admin/employees/[membershipId]`, …). `next.config.ts` has no `output: "export"`, and cannot have one: static export does not support Server Actions or dynamic segments. Capacitor's default model — bundle a static web build inside the app — therefore does not fit as-is.

The practical path is the **remote-loaded shell**: the native app's WebView loads `https://hrms.flowacord.com` (Capacitor `server.url`), the Capacitor runtime ships inside the web bundle, and native capabilities (precise location, camera, push, share, background tracking) are reached through the Capacitor bridge. In this model:

| Question from the brief | Answer, with evidence |
|---|---|
| How much can be reused unchanged? | **About 97% of the code** — all of `src/lib` (24,896 lines, business logic and server actions), all of `src/app` server components, the Prisma/Supabase data layer, auth, consent, billing, payroll. Only 8–10 client files touch browser APIs that behave differently in a WebView (listed in §4). |
| What needs minor adaptation? | Foreground geolocation in `AttendanceActionCard.tsx` and `LocationPicker.tsx` (behind a `LocationService`); `window.open`/`window.print` in 4 files; `target="_blank"` links (12); Android back button and app-lifecycle hooks in the two shells; the password-reset email flow; the opening animation's media settings; a native "no connection" page. |
| What genuinely needs native capability? | **Background (field-force) location** — impossible from a WebView, needs a Capacitor plugin with a foreground service (Android) and "Always" location (iOS), plus new consent. **Push notifications** (FCM/APNs). **Print/PDF** (WebView has no `window.print`). **Deep links** (App Links / Universal Links). Biometrics (future). |
| Largest risks? | (1) Apple guideline 4.2 "minimum functionality" for a remote-loaded app; (2) background-location policy at Google/Apple and under the DPDP Act; (3) a remote-loaded app cannot start without network and goes down when the site does; (4) iOS builds need a Mac; (5) in-app payment of the subscription on iOS (guideline 3.1.1). All have mitigations (§6). |
| Safest sequence? | Android first, remote-loaded shell, foreground location plugin before any background tracking, push after that, iOS once Android is stable. See `CAPACITOR_MIGRATION_PLAN.md`. |

**Bottom line:** no Kotlin/Swift rewrite is justified. Native code is warranted in exactly one place — background location — and even there a maintained plugin should be tried before custom code.

## 2. Codebase inventory (evidence)

| Area | Finding | Where |
|---|---|---|
| Framework | Next.js **16.3.0** (App Router, Turbopack), React 19.2.8, TypeScript 5, Tailwind 4 | `package.json` |
| Rendering | Server components + Server Actions; `"use client"` in 107 component files; no `output: "export"` | `next.config.ts` (only `logging` and `headers`) |
| Routing | 80+ routes across groups `(admin)`, `(employee)`, `(auth)`, `(platform)`, `(home)`, `(marketing)`, `(legal)`, plus `/subscription`, `/print/id-cards`, `/consent`, `/trial-ended` | `src/app/**` |
| Server | `next start` behind a small launcher, `PORT` from env, keep-alive 70 s; hosted on Hostinger Web App at hrms.flowacord.com | `scripts/start-server.mjs`, `DEPLOY.md` |
| Auth | Supabase Auth; browser client `createBrowserClient` (session in **cookies**, not localStorage); server client bound to request cookies; session refreshed and gated in `src/proxy.ts`; sign-out is `POST /auth/sign-out` → 303 | `src/lib/supabase/{client,server}.ts`, `src/proxy.ts` |
| Authorisation | `requireSession` / `requireAdminArea` / `checkAccess` server-side; RLS enabled on 52 tables | `src/lib/authz/guard.ts`, `scripts/setup-rls.ts` |
| Database | PostgreSQL (Supabase) via Prisma 7 + `@prisma/adapter-pg`; migrations additive; server-only | `prisma/`, `src/lib/db.ts` |
| Files | Browser uploads straight to private Supabase Storage buckets (`task-proof`, `employee-documents`, `expense-receipts`, `company-media`); reads through short-lived signed URLs minted server-side | `src/lib/*/upload.ts`, `src/lib/media/urls.ts` |
| Camera | `<input type="file" capture="environment|user">` in 4 places; canvas-based downscale and crop (`createImageBitmap`) | `FileUpload.tsx`, `MyDocuments.tsx`, `ClaimForm.tsx`, `PhotoPicker.tsx`, `ImageCropper.tsx` |
| Geolocation | `navigator.geolocation.getCurrentPosition` in **2** files only; no `watchPosition`; check-in has its own permission-prompt watchdog; the same `computeCheckInState` runs on client and server | `AttendanceActionCard.tsx:124`, `LocationPicker.tsx:195`, `src/lib/attendance/policy.ts` |
| Offline | IndexedDB queue for `checkIn`, `checkOut`, `leaveRequest`, `taskProof`; sync on reconnect / load / tab visible; server refusal is surfaced, only transport failures retry; records carry `offlineCaptured` and original capture time | `src/lib/offline/{store,queue,sync}.ts`, `OfflineProvider.tsx` |
| PWA | Web manifest (`display: standalone`, icons as routes); **no service worker** (a recorded decision, D-P9-10); `viewport-fit: cover`; safe-area padding in employee layout and bottom nav | `src/app/manifest.ts`, `src/app/layout.tsx`, `DECISIONS.md` |
| Notifications | In-app bell + email; action tiles polled every **30 s** while the tab is visible; WebAudio chime created on first gesture; **no web push** | `ActionQueueProvider.tsx:58`, `chime.ts`, `src/lib/notifications` |
| External scripts | Google Maps JS (location picker, key-gated), Razorpay Checkout (`checkout.js`) | `LocationPicker.tsx:44`, `SubscribeForm.tsx:53` |
| Browser-only APIs | `window.print` ×2, `window.open` ×2, `target="_blank"` ×12, `navigator.clipboard` ×3, `matchMedia` ×5, `visibilityState` ×3, `AudioContext` (chime, splash), `sessionStorage` (splash once-per-session), `localStorage` (chime preference) | grep counts, §4 |
| Env | 21 `process.env` keys; only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` reach the browser (baked at build) | grep |
| Deep links in email | `/invite/[token]`, `/verify-email/[token]`, `/reset` (Supabase recovery redirect), `/subscription/invoice/[id]` | `src/lib/invites/token.ts`, `src/lib/signup/actions.ts`, `forgot-password/ForgotPasswordForm.tsx:50`, `src/lib/billing/activate.ts` |
| Bundle | Largest client chunks 280 K, 248 K, 224 K (uncompressed); no `next/image` except one marketing component; fonts self-hosted via `next/font` | `.next/static/chunks` |
| Tests | 39 files, 719 tests, incl. integration tests against the real database in rolled-back transactions | `src/tests` |

Nothing in the codebase assumes Chrome or Safari by user-agent. `src/proxy.ts` gates on Supabase cookies only.

## 3. Target architecture (recommended)

```
Web (hrms.flowacord.com, unchanged)
        ▲ https, first-party cookies
        │
 ┌──────┴───────────────────────────────────┐
 │ Capacitor shell (Android / iOS)          │
 │  WebView loads server.url = the site     │
 │  Capacitor bridge + plugins:             │
 │   Geolocation · Camera · Filesystem ·    │
 │   Share · Browser · App · Network ·      │
 │   Push · LocalNotifications · StatusBar ·│
 │   SplashScreen · (Background location)   │
 │  Local fallback page (server.errorPath)  │
 └──────────────────────────────────────────┘
        ▲
        │ bridge calls from the web bundle, through a service layer
        │
   src/lib/platform/*  — LocationService, CameraService, ShareService,
                         NotificationService, AppLifecycleService,
                         NetworkService (web impl + Capacitor impl)
```

- **One codebase, one backend.** Business screens call the service layer; they never import Capacitor directly. On the web the services use browser APIs; on Android/iOS `Capacitor.isNativePlatform()` selects the plugin implementation.
- **Auth stays as it is.** Because the WebView's origin *is* `hrms.flowacord.com`, Supabase cookies are first-party; `src/proxy.ts` refreshes sessions exactly as in a browser. No token handling moves to native code (see §6 on secure storage).
- **Server Actions keep working** — they are POSTs to the page's own origin.
- **Web deployment is untouched.** The shell is a separate build artefact; a web deploy does not need a store release, and a store release does not need a web deploy.

Why not bundle the web app inside the APK? It would require converting FlowHRMS to a static client-rendered app with a separate API — an **E-class rewrite** of the data layer for no product gain today. It can be revisited if offline cold-start becomes a hard requirement (see `OPEN_DECISIONS.md` §5).

## 4. Files that need touching (the whole list)

| File | Why | Class |
|---|---|---|
| `src/components/attendance/AttendanceActionCard.tsx` | Foreground GPS via `LocationService` (plugin on native: precise, one OS prompt, works when app is foregrounded) | B→C |
| `src/components/maps/LocationPicker.tsx` | Same `LocationService` for "Use my current location"; Google Maps loads as-is | B |
| `src/app/(admin)/admin/employees/[membershipId]/DocumentsPanel.tsx`, `src/components/expenses/ReceiptLink.tsx` | `window.open(signedUrl)` → `Browser.open` / Filesystem + Share on native | B |
| `src/app/subscription/invoice/[id]/PrintButton.tsx`, `src/app/(platform)/platform/consents/[id]/PrintButton.tsx`, `src/app/print/id-cards/page.tsx` | `window.print` is a no-op in WebViews → server-rendered PDF + Share | C |
| `src/app/(platform)/platform/consents/export/route.ts` | `Content-Disposition: attachment` download → Filesystem + Share on native | C |
| `src/app/(auth)/forgot-password/ForgotPasswordForm.tsx` | PKCE reset link fails when opened in a different browser/app → use Supabase `token_hash` recovery links | B (a web bug too) |
| `src/components/shell/SplashScreen.tsx` | WebView media settings (inline playback, autoplay muted); native splash first | B |
| `src/app/(employee)/layout.tsx`, `src/app/(admin)/admin/layout.tsx` | Mount `AppLifecycleService` (Android back button, resume → sync, status bar) | B |
| `src/lib/actions/ActionQueueProvider.tsx`, `src/lib/offline/OfflineProvider.tsx` | Use `App.appStateChange` / `Network` events in addition to `visibilitychange` / `online` | B |
| Root layout / links with `target="_blank"` (12) | Open in system browser via `Browser` plugin (one shared `ExternalLink` component) | B |

Everything else — payroll, leave, tasks, expenses, performance, billing, consent, platform — is untouched.

## 5. What the WebView gives for free (verified against the code)

- **Camera and gallery:** `<input type="file" capture>` opens the camera on Android WebView and iOS WKWebView. The Camera plugin is an upgrade (better prompts, HEIC→JPEG), not a requirement.
- **Uploads to Supabase Storage** from the page: origin is the site; Supabase CORS allows it.
- **IndexedDB offline queue:** supported in both WebViews. Risk noted in the matrix: iOS may purge website data for unused domains; a Capacitor `Preferences`/SQLite mirror is the long-term fix.
- **`<dialog>` modals and bottom sheets, `100dvh`, `env(safe-area-inset-*)`:** all supported; `viewport-fit=cover` is already set.
- **`tel:` and `mailto:` links:** Capacitor hands them to the OS.
- **`visibilitychange` and `online` events:** fire in WebViews; the native events are more reliable and are added, not substituted.
- **Fonts, CSS, Tailwind, React 19:** no change.

## 6. Risks and mitigations

| Risk | Mitigation |
|---|---|
| **Apple review, guideline 4.2** — "your app is just a website" | Ship with real native behaviour from the first iOS build: native splash, Geolocation plugin, Camera plugin, push, Share, deep links; app opens at sign-in/home, never at the marketing site; provide a reviewer demo account (the sample company) and review notes. Keep 4.2 in mind when ordering phases (Android first). |
| **Remote-loaded shell needs network to start; site outage = app outage** | Same as today's PWA (no service worker). Add a bundled `server.errorPath` page ("You're offline — your saved check-ins will send when you're back"); the IndexedDB queue already holds work. Treat hosting uptime as part of the app's SLA. Revisit a bundled shell only if offline cold-start becomes a requirement. |
| **Bridge compatibility over time** | The site must keep working with the oldest shell still installed. Version the service layer; the shell reports its version in a header; the site degrades to web behaviour when a plugin is missing. |
| **Background location** — Google Play policy form, Apple "Always" review, battery, DPDP | Separate phase, off by default, explicit per-company enablement + per-employee consent (new notice version), work-hours only, visible tracking state, retention rule, audit. Details in the geolocation plan. |
| **iOS location prompts inside WKWebView** — website-style prompt every session, unreliable when suspended | Use `@capacitor/geolocation` on native (CoreLocation, one OS prompt). |
| **Payments inside the iOS app** — selling the subscription via Razorpay in-app may breach guideline 3.1.1 | On iOS, hide the Pay button and show "Manage your plan on the web"; Android is fine. See `OPEN_DECISIONS.md` §9. |
| **Print/download in WebView** | Server-side PDF (puppeteer-core is already a devDependency; or a PDF library) + Share sheet. |
| **Razorpay UPI intents** (GPay/PhonePe app hand-off) inside WebView | Test on Android in Phase 2; `allowNavigation`/intent handling or the community Razorpay Capacitor plugin if needed. |
| **iOS builds require macOS + Xcode** | Cloud Mac/CI (Codemagic, GitHub Actions macOS runners) or a Mac mini. Decision needed. |
| **Cookie persistence in WebView** | Android WebView and WKWebView persist cookies across launches by default; verify after force-quit and after 7+ days idle in Phase 2 device testing. |

## 7. Security posture (no change to what is stored)

- Session tokens live in **cookies inside the WebView's sandboxed cookie store**, never in `localStorage` or in native code. `src/lib/supabase/client.ts` uses the `@supabase/ssr` browser client (cookie storage). Nothing in the app reads or forwards tokens.
- Server-side gating remains the enforcement (`SECURITY-NOTES.md`): the shell does not get any new trust.
- Native plugins add OS permissions only (location, camera, photos, notifications), each with a stated purpose string.
- Biometrics, if wanted later, would be a **local unlock in front of the existing session**, not a token store (`OPEN_DECISIONS.md` §8).

## 8. What this audit deliberately did not do

Install Capacitor, create `android/` or `ios/` projects, change auth, alter geolocation, add a service worker, or change the database. The `docs/md/mobile/` folder is the only addition.
