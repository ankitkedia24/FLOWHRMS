# FlowHRMS — Android Release Plan

Future steps, documented in order. **Nothing here has been executed.** Assumes the remote-loaded shell (`server.url`). Versions: Capacitor's current major at the time of Phase 1 (7.x at the time of this audit — confirm), JDK 17+, Android Studio current stable.

## 0. Accounts and identifiers (decide first — `OPEN_DECISIONS.md` §3)

- **Application ID:** `com.flowacord.flowhrms` (cannot change after the first Play upload).
- **App name:** FlowHRMS. **Play developer account:** Flowacord (one-time fee), owned by the company, not an individual.
- **Signing:** Google Play App Signing (Google holds the app signing key; Flowacord holds the upload key).

## 1. Add Capacitor to the repository (Phase 1)

```bash
npm i @capacitor/core
npm i -D @capacitor/cli @capacitor/assets
npx cap init FlowHRMS com.flowacord.flowhrms --web-dir mobile/www
```

- `mobile/www/` holds only the bundled fallback: `index.html` (redirects to the site), `offline.html` (the `server.errorPath` page), brand assets. The real app is the site.
- `capacitor.config.ts`:

```ts
import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "com.flowacord.flowhrms",
  appName: "FlowHRMS",
  webDir: "mobile/www",
  server: {
    url: "https://hrms.flowacord.com/sign-in?next=/",
    errorPath: "offline.html",
    // Hosts the WebView may navigate to (payments, maps); scripts from other hosts need nothing here.
    allowNavigation: ["hrms.flowacord.com", "api.razorpay.com", "checkout.razorpay.com"],
  },
  android: { allowMixedContent: false },
  plugins: { SplashScreen: { launchAutoHide: false }, Keyboard: { resize: "body" } },
};
export default config;
```

- The web app gets the service layer (`src/lib/platform/*`) and `@capacitor/core` in its bundle; `Capacitor.isNativePlatform()` false on the web → no behaviour change for browsers. Deploy the web app **before** the first shell build so the bridge is present.

## 2. Create the Android project (Phase 2)

```bash
npm i @capacitor/android @capacitor/app @capacitor/splash-screen @capacitor/status-bar @capacitor/network @capacitor/keyboard @capacitor/browser @capacitor/share @capacitor/filesystem @capacitor/geolocation @capacitor/camera @capacitor/device
npx cap add android
npx cap sync android
npx cap open android      # Android Studio
```

- **Version:** `android/app/build.gradle` → `versionCode` (integer, increases every upload) and `versionName` (e.g. `1.0.0`). Keep them in `package.json`'s version via a small script.
- **Icons and splash:** put a 1024×1024 PNG icon and a 2732×2732 splash in `mobile/assets/`, run `npx capacitor-assets generate --android`. Adaptive icon with the mark on `#010123`.
- **`AndroidManifest.xml` permissions (Phase-gated):**
  - Phase 2: `INTERNET` (default), `ACCESS_NETWORK_STATE`.
  - Phase 3: `CAMERA`, `READ_MEDIA_IMAGES` (13+) / `READ_EXTERNAL_STORAGE` (≤12), `POST_NOTIFICATIONS` (13+, Phase 6).
  - Phase 4: `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`.
  - Phase 5 only: `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION` — plus the Play Console location declaration.
- **Deep links (App Links):** intent filter for `https://hrms.flowacord.com` paths `/invite/*`, `/verify-email/*`, `/reset`, `/subscription/invoice/*` with `android:autoVerify="true"`; publish `/.well-known/assetlinks.json` on the site with the upload-key and Play signing-key SHA-256 fingerprints.
- **WebView settings:** Capacitor sets `mediaPlaybackRequiresUserGesture=false` and enables DOM storage; confirm cookies persist (`CookieManager` accept + persist) after force-quit.
- **Min SDK:** Capacitor's minimum (API 23) is fine; consider **API 26 (Android 8)** as the support floor for customers' phones (`OPEN_DECISIONS.md` §10).

## 3. Build variants and local testing

- `debug`: `./gradlew assembleDebug` → `android/app/build/outputs/apk/debug/app-debug.apk`; install with `adb install` or share the file for direct testing. Debug builds may point `server.url` at a staging host through a `capacitor.config` override (`CAPACITOR_SERVER_URL` env at sync time).
- `release`: signed with the upload keystore.
- **Keystore:** `keytool -genkeypair -v -keystore flowhrms-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000`. Keep it and its passwords in the password manager, never in the repo or chat; back it up offline. Losing it means a Play support request.
- `android/keystore.properties` (git-ignored) referenced from `build.gradle` `signingConfigs.release`.
- Device test matrix (Phase 2/7): Android 8, 10, 12, 14/15; a budget phone (2–3 GB RAM); Chrome WebView updated and outdated; battery saver on; Jio/Vi 4G with poor signal.

## 4. Play Store (Phase 7 → 9)

1. **Bundle:** `./gradlew bundleRelease` → `app-release.aab` (Play requires AAB).
2. **Play Console → Create app** → Business category → free.
3. **App content:** privacy policy URL (`https://hrms.flowacord.com/privacy`), **Data safety** form (collected: name, email, phone, precise location at check-in — and *background* location only if Phase 5 ships; photos/files; user IDs; data encrypted in transit; deletion via account request), target audience 18+, ads: none, content rating questionnaire.
4. **Permissions declarations:** location (foreground) needs an in-app disclosure video only if background; background location (Phase 5) needs the full declaration and video.
5. **Testing tracks:** Internal testing (up to 100 testers by email, immediate) → Closed testing (customer pilots) → Production. New personal developer accounts must run a closed test with 12+ testers for 14 days before production; a company account is exempt — another reason to register as Flowacord.
6. **Target API level:** Play requires new apps to target a recent API level (API 34–35 as of 2025; check the current requirement at release). Capacitor's Android template tracks this.
7. **Release notes, screenshots** (phone 16:9 and 9:16, at least 2), feature graphic 1024×500, short and full description. Reuse marketing copy; no "tenant" wording.
8. **Store listing review** typically 1–7 days; policy issues come back as "rejected with reasons" — fix, re-upload.

## 5. Ongoing

- A web deploy needs no app release. An app release is needed only when the shell, plugins, permissions or native config change.
- Keep a `SHELL_VERSION` in the shell (from `App.getInfo().version`) sent as a request header; the site logs it and can show "Update the app" when a plugin it needs is missing.
- Crash reporting: Play Console vitals (free) first; Sentry/Crashlytics later if needed.
