# FlowHRMS — Mobile Compatibility Matrix

Audit date 28 Sept 2026, `main` at `6fb03ce`. Assumes the **remote-loaded Capacitor shell** described in `CAPACITOR_READINESS_AUDIT.md` §3.

Classes: **A** works unchanged · **B** small Capacitor adaptation · **C** Capacitor/native plugin required · **D** custom Kotlin/Swift may be required · **E** architectural change required.
Effort: **S** < 1 day · **M** 1–3 days · **L** 1–2 weeks · **XL** > 2 weeks. Risk: low / medium / high.

## Platform and framework

| Feature | Class | Evidence | Reason / solution | Risk | Effort |
|---|---|---|---|---|---|
| Next.js 16 App Router, server components, dynamic routes | **A** (remote) / **E** (bundled) | no `output: "export"` in `next.config.ts`; 37 `"use server"` files | Remote shell loads the live site; static export is impossible without rewriting the data layer | low / high | — / XL |
| Server Actions (all writes) | **A** | `src/lib/**/actions.ts` | Same-origin POSTs from the WebView | low | — |
| Prisma + PostgreSQL, RLS | **A** | server-only | Untouched | low | — |
| `src/proxy.ts` session gate | **A** | cookie-based, no UA checks | Runs on the server for every WebView request | low | — |
| Environment variables | **A** | 4 `NEXT_PUBLIC_*` baked into the web bundle | Remote shell uses the site's build; no native env needed except plugin keys (FCM) | low | — |
| Fonts (`next/font`), Tailwind 4, `<dialog>`, `dvh`, safe-area | **A** | `src/app/layout.tsx` sets `viewport-fit: cover`; `BottomNav.tsx` pads safe areas | Supported by Android WebView (Chromium) and WKWebView | low | — |

## Authentication and session

| Feature | Class | Evidence | Reason / solution | Risk | Effort |
|---|---|---|---|---|---|
| Sign-in (`signInWithPassword`) → cookies → `router.replace` | **A** | `SignInForm.tsx:58–67` | First-party cookies in the WebView | low | — |
| Session refresh, sign-out (`POST /auth/sign-out` → 303) | **A** | `src/proxy.ts`, `auth/sign-out/route.ts` | Unchanged | low | — |
| Cookie persistence across app restarts | **A** (verify) | `@supabase/ssr` cookie storage | Both WebViews persist cookies; verify after force-quit and long idle in device testing | medium | S |
| Password reset via email link | **B** | `ForgotPasswordForm.tsx:50` uses PKCE `redirectTo: origin/reset` | PKCE verifier is a cookie in the requesting browser; a link opened in the app (or another browser) fails. Switch Supabase recovery emails to `token_hash` links handled by `/reset`. Fixes an existing web bug too | medium | S |
| Invitation and verify-email links from email | **C** | `inviteUrl()`, `/verify-email/[token]` | Work in the system browser today. For in-app opening: Android App Links + iOS Universal Links + `@capacitor/app` `appUrlOpen` routing | low | M |
| Secure token storage | **A** | no tokens in `localStorage` (grep) | Nothing to move; keep it that way | low | — |
| Biometric unlock (future) | **C** | none today | `@capacitor-community/biometric-auth` (or `capacitor-native-biometric`) as a local gate in front of the session; no token in native storage | medium | M |

## Attendance and location

| Feature | Class | Evidence | Reason / solution | Risk | Effort |
|---|---|---|---|---|---|
| Check-in / check-out GPS (foreground) | **B → C** | `AttendanceActionCard.tsx:124` `getCurrentPosition`, 10 s timeout + prompt watchdog | Works in WebView; on iOS the WebView shows a website-style prompt each session and fails when suspended. Use `@capacitor/geolocation` behind `LocationService` (one OS prompt, precise, foreground-reliable) | medium | M |
| Location assessment logic | **A** | `computeCheckInState` shared client/server (`policy.ts:491`) | Unchanged | low | — |
| Multiple punches per day | **A** | `AttendancePunch`, feature `multiple_punch` | Unchanged | low | — |
| Work-location map picker (Google Maps JS) | **A** (+B) | `LocationPicker.tsx:44` | Loads in WebView; API key referrer is the site origin. "Use my current location" via `LocationService` | low | S |
| **Background / field-force tracking** | **C / D** (+ **E** for consent) | nothing today; GPS module says "not continuous" | Needs a background-location plugin, Android foreground service, iOS Always permission, new consent purpose, new tables. See the geolocation plan | high | L–XL |

## Camera, files and media

| Feature | Class | Evidence | Reason / solution | Risk | Effort |
|---|---|---|---|---|---|
| Take photo / choose photo | **A** (C optional) | `capture="environment|user"` ×4 | WebView file chooser opens the camera. `@capacitor/camera` later for better prompts and HEIC handling | low | S–M |
| Client-side crop and downscale (canvas) | **A** | `ImageCropper.tsx`, `media/upload.ts` | Pointer events + canvas work in both WebViews | low | — |
| Direct uploads to Supabase Storage | **A** | `uploadMedia`, `uploadDocument`, expenses, task proof | Same origin as web; Supabase CORS permits | low | — |
| Viewing a signed-URL file (`window.open`) | **B** | `DocumentsPanel.tsx:59`, `ReceiptLink.tsx:32` | `window.open` is unreliable in WebViews → `@capacitor/browser` (view) or Filesystem + Share (save) | low | S |
| CSV export download | **C** | `consents/export/route.ts` (`Content-Disposition`) | WebViews don't download; fetch → `@capacitor/filesystem` → `@capacitor/share` | low | S |
| **Print** (invoice, consent certificate, ID cards) | **C** | `window.print` ×2, `/print/id-cards` | No print in WebViews. Server-side PDF endpoint (puppeteer-core already a devDependency, or `@react-pdf`) + Share sheet; web keeps `window.print` | medium | M |
| Opening animation (video with sound) | **B** | `SplashScreen.tsx` | Capacitor config: `allowsInlineMediaPlayback`, Android `mediaPlaybackRequiresUserGesture=false`; native splash first | low | S |
| Google Maps and Razorpay external scripts | **A / B** | `LocationPicker.tsx`, `SubscribeForm.tsx` | Scripts load fine. Razorpay UPI app hand-off needs device testing; `server.allowNavigation` or community plugin if it fails. iOS: see payments decision | medium | S–M |

## Notifications and background work

| Feature | Class | Evidence | Reason / solution | Risk | Effort |
|---|---|---|---|---|---|
| In-app action tiles, 30 s polling while visible | **A** (+B) | `ActionQueueProvider.tsx:58,115` | Works; add `App.appStateChange` so resume triggers a refresh even when `visibilitychange` doesn't fire | low | S |
| Chime (WebAudio after first gesture) | **A** | `chime.ts` | Same rules in WebViews | low | — |
| **Push notifications** | **C** (+ backend) | none today; email + in-app only | `@capacitor/push-notifications`, FCM (Android) + APNs (iOS); new `device_tokens` table and a sender in `src/lib/notifications`; opt-in per person | medium | L |
| Local notifications (check-out reminder) | **C** | reminder is in-page today | `@capacitor/local-notifications` scheduled at check-in for shift end | low | S |
| App badge | **C** | — | `@capacitor/app` badge via push payload / community badge plugin | low | S |

## Offline and network

| Feature | Class | Evidence | Reason / solution | Risk | Effort |
|---|---|---|---|---|---|
| Offline queue (IndexedDB) for check-in/out, leave, task proof | **A** | `offline/store.ts` (IndexedDB), `sync.ts` | Works in both WebViews. iOS may evict website data after long disuse → mirror the queue to `@capacitor/preferences` or SQLite in a later phase | medium | M (later) |
| Never claim success offline | **A** | `AttendanceActionCard.tsx:198–283` says "saved on this phone… sent when back online"; server refusals surfaced | Already correct; keep `offlineCaptured` + capture time | low | — |
| Online/offline detection | **A** (+C) | `navigator.onLine`, `online` event | Add `@capacitor/network` for accuracy | low | S |
| Cold start with no network | **B** | no service worker (D-P9-10) | Bundled `server.errorPath` page in the shell; retry button | low | S |

## Shell, navigation and OS integration

| Feature | Class | Evidence | Reason / solution | Risk | Effort |
|---|---|---|---|---|---|
| Android hardware back button | **B** | Next router, `<dialog>` modals | `@capacitor/app` `backButton`: close open dialog → `router.back()` → exit at root | low | S |
| Status bar colour / style | **C** | `themeColor #010123` | `@capacitor/status-bar` | low | S |
| Keyboard over bottom sheets and sticky buttons | **B** | `Modal.tsx` bottom sheet, sticky "Add employee" button | `@capacitor/keyboard` (resize mode) + `visualViewport` handling | medium | S–M |
| `target="_blank"` and `tel:`/`mailto:` links | **B / A** | 12 `_blank`; `tel:`/`mailto:` in 3 files | `_blank` → `@capacitor/browser`; `tel:`/`mailto:` are handed to the OS by Capacitor | low | S |
| Share sheet | **C** | none | `@capacitor/share` for invoices, ID cards, invite links | low | S |
| Device info / app version | **C** | none | `@capacitor/device`, `@capacitor/app` `getInfo`; send shell version in a header for compatibility | low | S |
| Native splash + app icons | **C** | manifest icons are dynamic routes | `@capacitor/splash-screen`, `@capacitor/assets` from the brand SVG/PNG | low | S |
| Marketing pages inside the app | **B** | `/` is the marketing home | Shell opens `/sign-in` (or `/` which redirects signed-in users); hide marketing nav when `isNativePlatform()` | low | S |

## Screens that need mobile attention (summary — details in `MOBILE_UX_GAP_ANALYSIS.md`)

Admin tables (10 files use `<table>`), print pages, subscription payment on iOS, keyboard with sticky footers, permission prompt copy for location/camera/notifications.

## Totals

- **A:** 30 rows — the whole business layer and most of the UI.
- **B:** 12 rows — small, isolated edits, mostly in the two shells and 8 client files.
- **C:** 12 rows — official Capacitor plugins plus one community plugin (biometrics, background location).
- **D:** 1 row — background location, only if the plugin proves insufficient.
- **E:** 1 row — the bundled-shell alternative, explicitly not recommended now; and the consent/product change that background tracking would require.
