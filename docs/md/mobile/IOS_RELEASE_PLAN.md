# FlowHRMS — iOS Release Plan

Future steps, documented in order. **Nothing here has been executed.** Same remote-loaded shell as Android.

## 0. Hard prerequisites

- **A Mac with Xcode** (current stable; Xcode only runs on macOS). The team works on Windows today (`OPEN_DECISIONS.md` §4). Options: a Mac mini; a rented cloud Mac (MacinCloud, MacStadium); or CI-only builds on macOS runners (GitHub Actions macOS, Codemagic, Bitrise) with signing done by the CI. Local device debugging still needs a physical Mac.
- **Apple Developer Program**, organisation account in Flowacord's name (annual fee; needs a D-U-N-S number for an organisation — apply early, it can take 1–2 weeks).
- An iPhone for testing (iOS 16+); a second, older one if customers have them.

## 1. Create the iOS project (Phase 8)

```bash
npm i @capacitor/ios
npx cap add ios
npx cap sync ios
npx cap open ios          # Xcode
```

- **Bundle identifier:** `com.flowacord.flowhrms` (match Android). **Display name:** FlowHRMS. **Version** (`MARKETING_VERSION`) and **build** (`CURRENT_PROJECT_VERSION`, increases every upload).
- **Deployment target:** iOS 14+ is Capacitor's floor; recommend **iOS 15** or **16** (`OPEN_DECISIONS.md` §10).
- **Icons:** `npx capacitor-assets generate --ios` from the same 1024 PNG; App Store requires the 1024×1024 icon without alpha.
- **Launch screen:** the Capacitor storyboard with the mark on `#010123`; `@capacitor/splash-screen` hides it once the WebView has loaded, then the company animation may play.

## 2. Info.plist and capabilities (phase-gated)

| Key | Phase | Text (proposed) |
|---|---|---|
| `NSLocationWhenInUseUsageDescription` | 4 | "FlowHRMS records your location only when you check in or check out, to confirm you're at a permitted work location." |
| `NSLocationAlwaysAndWhenInUseUsageDescription` | 5 only | "If your company has switched it on and you have agreed, FlowHRMS records your location during work hours so your manager can see your visits. You can pause or stop this at any time." |
| `NSCameraUsageDescription` | 3 | "To take a photo for your profile, task proof, receipts or documents." |
| `NSPhotoLibraryUsageDescription` | 3 | "To choose a photo or receipt from your library." |
| `NSPhotoLibraryAddUsageDescription` | 3 (if saving ID cards) | "To save your ID card or invoice to your photos." |
| `UIBackgroundModes` → `location` | 5 only | — |
| Push Notifications capability + APNs key | 6 | — |
| Associated Domains: `applinks:hrms.flowacord.com` | 3 | — |
| `NSAppTransportSecurity` | — | Not needed; everything is https |

- **Universal Links:** publish `/.well-known/apple-app-site-association` on the site (paths `/invite/*`, `/verify-email/*`, `/reset`, `/subscription/invoice/*`) with the Team ID + bundle id; `@capacitor/app` `appUrlOpen` routes them in the WebView.
- **WKWebView settings:** Capacitor sets `allowsInlineMediaPlayback` and disables the user-gesture requirement for media where possible; cookies persist in the default `WKWebsiteDataStore`. If service workers or app-bound-domain restrictions are ever adopted, add `WKAppBoundDomains` = `hrms.flowacord.com`.

## 3. Signing, TestFlight, App Store Connect

1. Xcode → Signing & Capabilities → **Automatically manage signing** with the Flowacord team (creates the App ID, certificates and provisioning profiles). Distribution certificates live in the team's Keychain / CI secrets, never in the repo.
2. **App Store Connect → New app** (bundle id, SKU `flowhrms-ios`, primary language English (India)).
3. **Archive** (Product → Archive) → Distribute → App Store Connect → upload; or `xcodebuild -exportArchive` in CI with an `ExportOptions.plist`.
4. **TestFlight:** internal testers (team) immediately; external testers (customer pilots) after a short Beta App Review. Builds expire after 90 days.
5. **App privacy (nutrition labels):** contact info, user ID, precise location (linked to the user, for app functionality), photos, purchase history if Subscription is visible; "used for tracking": no.
6. **App Review notes:** explain FlowHRMS is a workforce app used by employees of paying companies; supply a **demo account** (the sample company's Employee and Owner logins); list native features (precise location at check-in, camera, push, share); state that the subscription is bought by the company on the web (if Pay is hidden on iOS — see `OPEN_DECISIONS.md` §9).
7. **Guidelines to design for:** 4.2 (minimum functionality — native features and polish), 5.1.1 (data collection and purpose strings), 3.1.1 (in-app purchase — hide external payment on iOS or apply the enterprise-services exception deliberately), 2.5.13 (no background location without a visible user feature).
8. **Release:** manual release after approval; phased release optional.

## 4. Ongoing

- Same rule as Android: web deploys need no app release; shell/plugin/permission changes do.
- Watch Xcode/iOS major releases each September — Capacitor and plugin updates usually follow within weeks; plan one maintenance build a year.
