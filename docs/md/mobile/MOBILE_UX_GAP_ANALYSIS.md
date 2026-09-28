# FlowHRMS — Mobile UX Gap Analysis

Audit date 28 Sept 2026. Reviewed against the code, not by wrapping and hoping. Each gap says what the WebView will do, what an app-quality experience needs, and whether shared components can carry the fix.

## 1. What is already app-grade (keep)

- **Phone-first employee shell:** bottom navigation capped at four items (`src/lib/shell/nav.ts`), safe-area padding on the bar and the content (`BottomNav.tsx:30`, `(employee)/layout.tsx:93`), `viewport-fit: cover` (`src/app/layout.tsx`), `100dvh` throughout.
- **Touch targets:** buttons are 44 px+ (`Button.tsx` sizes `h-11`/`h-12`/`h-14`); nav items `min-h-11`.
- **Bottom sheets:** `Modal` and `Drawer` render as bottom sheets under `md` using native `<dialog>` (focus trap, Esc, backdrop for free).
- **Loading states:** `loading.tsx` in both shells; skeletons rather than spinners.
- **Offline:** persistent offline bar, queued check-in/out with honest wording ("saved on this phone… sent when you're back online").
- **Forms:** `inputMode`, `autoComplete`, `type="tel"/"email"/"date"/"time"` used consistently; errors next to fields; consequence sentences before destructive or access-granting actions.
- **No hover-only interactions** found in the app shells (marketing pages excepted).

## 2. Gaps, by screen or pattern

| # | Screen / pattern | What happens in a WebView today | App-quality target | Fix (shared where possible) | Priority |
|---|---|---|---|---|---|
| 1 | **App start** | Opens `/` → marketing home for a signed-out person | Native splash → sign-in (or straight to `/home` / `/admin` when a session exists) | Shell start URL `/sign-in?next=/`; hide marketing nav and footer when `Capacitor.isNativePlatform()`; native splash (`@capacitor/splash-screen`) then the company animation | High |
| 2 | **Android back button** | WebView history back; can leave a `<dialog>` open or exit unexpectedly at the root | Back closes an open sheet/dialog, then goes back, then exits at `/home` or `/admin` | `AppLifecycleService.onBack` mounted in both shells; `Modal`/`Drawer` register themselves | High |
| 3 | **Check-in card permission prompt** (`AttendanceActionCard`) | Browser-style location prompt; on iOS repeated per session; "denied" state text assumes a browser setting | One OS prompt with FlowHRMS's purpose; if denied, a button that opens app settings (`@capacitor/app` → settings intent) | `LocationService` + platform-aware copy in the card | High |
| 4 | **Camera flows** (task proof, documents, expenses, photo) | `<input capture>` opens the system chooser; works, but the chooser is generic and HEIC photos from iPhones arrive as HEIC | Direct "Take photo" that opens the camera, JPEG back, then the existing cropper | `CameraService` (web: file input; native: `@capacitor/camera`) inside `FileUpload` and `PhotoPicker` | Medium |
| 5 | **Keyboard with sticky footers** (Add employee's sticky submit, bottom-sheet forms) | On iOS the keyboard can cover the sticky button; sheets don't shrink | Content scrolls above the keyboard; sticky actions stay visible | `@capacitor/keyboard` resize mode + `visualViewport`-aware padding in `Modal`/sticky footers | Medium |
| 6 | **Admin tables** — 10 files use `<table>` (`admin/attendance`, `employees`, `payroll`, `salaries`, `tasks`, `activity`, `platform/*`, invoice) | Some already switch to stacked cards under `md` (activity page does); others rely on horizontal scroll | Every table either stacks into cards on phones or scrolls horizontally inside a container with a visible edge | Audit each; reuse the activity page's mobile-card pattern; `overflow-x-auto` wrapper as the minimum | Medium |
| 7 | **Print pages** (`/print/id-cards`, invoice, consent certificate) | `window.print()` does nothing in WebViews; the ID-card sheet is laid out for A4 | "Share / Save PDF" that produces a real PDF | Server-side PDF endpoint + `@capacitor/share`; keep `window.print` on the web | Medium |
| 8 | **Opening a file** (`DocumentsPanel`, `ReceiptLink`) | `window.open(signedUrl, "_blank")` is ignored or opens in-place, losing the app | Opens in an in-app viewer or the system viewer, back returns to the app | `@capacitor/browser` for view, `Filesystem` + `Share` for save | Medium |
| 9 | **External links** (`target="_blank"`: terms, privacy, invoice, ID card) and `mailto:`/`tel:` | `_blank` inconsistent in WebViews; `tel:`/`mailto:` work | Legal pages open in an in-app browser sheet; `tel:` dials | One `ExternalLink` component using `Browser.open` on native | Low |
| 10 | **Subscription / Pay (Razorpay Checkout)** | Checkout loads; UPI app hand-off may open outside the WebView and not return; on iOS the whole in-app purchase question | Android: works after `allowNavigation`/plugin testing; iOS: replace Pay with "Manage your plan on the web" | Platform check in `SubscribeForm`; see `OPEN_DECISIONS.md` §9 | High (iOS) |
| 11 | **Opening animation** | Autoplay-with-sound rules differ per WebView; the "Tap for sound" fallback covers it | Plays full screen after the native splash, sound where allowed | Capacitor media config; nothing in the component | Low |
| 12 | **Network loss on cold start** | WebView error page ("webpage not available") | Branded "You're offline" page with retry and "your saved work will send when you're back" | `server.errorPath` bundled page | High |
| 13 | **Resume after hours in the background** | Page state may be stale; polling resumes on `visibilitychange` | Resume refreshes tiles and syncs the queue immediately | `App.appStateChange` → `OfflineProvider.sync()` + `ActionQueueProvider.refresh()` | Medium |
| 14 | **Status bar and system colours** | Default | Status bar matches `#010123`/surface per shell; dark icons on light headers | `@capacitor/status-bar` in the shells | Low |
| 15 | **Text selection / tap highlight / overscroll** | Blue tap flashes and rubber-band overscroll feel web-like | No tap highlight on controls, `overscroll-behavior: none` on the shell, selectable text only in content | 3 lines in `globals.css` guarded by a `[data-native]` attribute set by the shell | Low |
| 16 | **Long lists** (employees 200, tasks, activity) | Fine; server-paginated | Same | — | — |
| 17 | **Permission rationale screens** (location, camera, notifications) | Only the OS prompt | A one-screen "why we ask" before each first prompt (Play policy requires it for background location; good practice for the rest) | Shared `PermissionRationale` sheet | Medium |
| 18 | **App icons and store assets** | Manifest icons are generated routes (`/icons/[size]`) | Static icon and splash sets in all densities | `@capacitor/assets` from `public/brand` | Low |

## 3. Screens that need no change

Employee home, attendance history, leave, tasks list/detail, notifications, payslips list, profile, account, consent, trial-ended, subscription (Android), platform area (desktop-only by nature), sign-in, invitation acceptance, sign-up (`/start`).

## 4. Principle for all fixes

Business screens stay shared. Platform differences are decided in one place — the service layer under `src/lib/platform/` and a `[data-native]` attribute on `<html>` set by the shell — never with `if (isAndroid)` scattered through components.
