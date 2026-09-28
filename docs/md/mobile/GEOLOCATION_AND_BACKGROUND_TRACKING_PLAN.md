# FlowHRMS — Geolocation and Background Tracking Plan

Audit date 28 Sept 2026. Plan only; nothing implemented.

## 1. What exists today (evidence)

| Item | Where | Behaviour |
|---|---|---|
| Location at check-in / check-out | `src/components/attendance/AttendanceActionCard.tsx:97–150` | `navigator.geolocation.getCurrentPosition` on mount when the company's policy requires location; `enableHighAccuracy`, 10 s timeout, 30 s cache; a separate watchdog (`GEO_DEADLINE_MS`) covers the case where the permission prompt is never answered — the card then treats it as *unconfirmed* rather than hanging |
| Assessment | `src/lib/attendance/policy.ts` `computeCheckInState` | The **same function** runs on the client (to show the consequence before the tap) and in the server action (`attendance/actions.ts:202, 649`) — the sentence shown is the sentence recorded |
| Storage | `AttendanceRecord` + `AttendancePunch` (`prisma/schema.prisma`) | Per punch: lat/lng, accuracy, distance to the location, outcome (`LocationOutcome`), reason when outside, `offlineCaptured`, original device time |
| Multiple punches | feature `ATTENDANCE.multiple_punch` | Several check-in/out pairs per day, each assessed against a location |
| Offline | `src/lib/offline/*` | Check-in/out queued in IndexedDB with coordinates and capture time; synced later; the server re-assesses |
| Roaming | `TenantMembership.canCheckInAtAnyBranch` | Any active location counts for field staff |
| Work-location picker | `src/components/maps/LocationPicker.tsx` | Admin's own position via `getCurrentPosition`; Google Maps search and pin |
| Consent | `src/lib/consent/documents.ts` employee notice v2 | "Your location — **only at the moment you check in and check out, never continuously**" — a required, separately ticked purpose |
| Product positioning | `src/lib/catalog.ts` `GPS_TRACKING` | "Event-based attendance and task proof — **not continuous tracking**. Optional; rules must be approved first." |

**The limitation the brief names is real:** browser geolocation only works while the page is alive and foregrounded. On iOS, a suspended Safari/WKWebView cannot deliver positions, and a PWA (no service worker here anyway) has no background execution at all. Nothing in FlowHRMS pretends otherwise; there is simply no background capability today.

## 2. Two capabilities, kept separate

### 2a. Attendance location (explicit events) — foreground, reliable

Goal: when someone taps Check in / Check out / (future) visit taps, capture a precise position every time, with one clear OS permission prompt, even if the app was just brought back from the background.

Design: a `LocationService` in `src/lib/platform/location.ts`:

```ts
interface LocationService {
  permissionState(): Promise<"granted" | "denied" | "prompt" | "unavailable">;
  requestPermission(): Promise<"granted" | "denied">;
  getCurrent(opts: { highAccuracy: boolean; timeoutMs: number; maxAgeMs: number }):
    Promise<{ lat: number; lng: number; accuracyM: number | null; at: Date } | { error: "denied" | "timeout" | "unavailable" }>;
}
```

- **Web implementation:** today's `navigator.geolocation` code, moved out of the card unchanged (including the watchdog).
- **Native implementation:** `@capacitor/geolocation` (official, maintained). Uses CoreLocation / Google Play Location Services: one OS-level prompt with FlowHRMS's own purpose text, precise location on request, and it keeps working the moment the app is foregrounded. On Android 12+ the person may grant *approximate* only — the service reports accuracy so `computeCheckInState` can treat a 1–2 km fix as unconfirmed, as it already does for poor accuracy.
- `AttendanceActionCard.tsx` and `LocationPicker.tsx` call the service; nothing else changes. `computeCheckInState` and the server action are untouched.

Why a plugin rather than the WebView's geolocation: on iOS, WKWebView shows a *website* permission prompt ("hrms.flowacord.com would like to use your location") that repeats per session and is separate from the app's own permission; it also has no access to precise location when the user has granted the app approximate only. On Android the WebView prompt works but adds a second, confusing layer over the app permission. Class **C**, effort **M**, risk low.

Permission texts (purpose strings) proposed:
- iOS `NSLocationWhenInUseUsageDescription`: "FlowHRMS records your location only when you check in or check out, to confirm you're at a permitted work location."
- Android: the same sentence shown in-app before the system prompt (the card already shows the consequence before the tap).

### 2b. Field-force / background location — only if approved

Goal (from the brief): when a company has enabled it *and* the employee has agreed, record the employee's position during work hours while the app is in the background, so a manager can see the day's movements (customer visits, travel).

**Feasibility:** possible only with native background execution. A WebView cannot do this; a PWA cannot do this. This is the one place in FlowHRMS where native capability is genuinely required.

**Plugin options (evaluate in this order):**

| Option | What it is | Fit |
|---|---|---|
| `@capacitor-community/background-geolocation` | Community plugin; Android foreground service with persistent notification, iOS `CLLocationManager` with Always permission; distance-filter based | Free, maintained, simplest. Enough for "where did they go during the day" at a few-hundred-metre resolution. Try first. |
| Transistorsoft `capacitor-background-geolocation` | Commercial (per-app licence); motion-detection based, battery-aware, geofences, HTTP sync with retry, well documented | Best reliability and battery behaviour; recommended if the community plugin's battery drain or gaps are unacceptable. |
| Custom Kotlin/Swift (class **D**) | Own foreground service / CoreLocation code behind a Capacitor plugin | Only if both plugins fail a specific requirement. Not expected. |

**Platform rules that cannot be worked around (and will not be):**
- Android: `ACCESS_BACKGROUND_LOCATION` requires a foreground service with a **visible, persistent notification** ("FlowHRMS is recording your work-time location"), the Play Console **location permissions declaration** with a video of the in-app disclosure, and a prominent in-app disclosure before the system prompt. Android 14+ needs `FOREGROUND_SERVICE_LOCATION`.
- iOS: "Always" location shows the **blue status indicator** while active and periodically reminds the user; Apple review requires the feature to be clearly user-facing and justified; usage strings must be specific.
- Battery: distance filter (e.g. 100–200 m) and stationary detection; never a fixed few-seconds interval.

**Privacy and employee controls (DPDP Act 2023):**
- A **new employee-notice version** with a separate, optional purpose: "work-time location tracking when my company switches it on"; the current v2 promises "never continuously", so tracking without new consent would contradict a published notice. Withdrawal must be one tap and must stop tracking immediately (`/account/privacy` already handles withdrawal flows).
- **Company-level switch** (module setting on `GPS_TRACKING`, off by default) and **per-employee enablement** with the date, who enabled it and the consent record id.
- **Work hours only:** tracking window = the person's shift (or the company default) ± a configurable margin; automatically off outside it and on weekly offs/holidays (the work calendar already exists).
- **Visible state:** a persistent "Location tracking is on" bar in the employee app (in addition to the OS indicators), with "Pause for today" (recorded) and "Stop and withdraw consent".
- **Role-based access:** the day's route visible to the employee themselves, their manager (reporting tree) and admins with a new `attendance.track_view` permission; every view audited (like `document.viewed`).
- **Retention:** a company setting, default **30 days** for raw points; daily summaries (visits, distance) may be kept longer. A purge job deletes raw points past retention.
- **Auditability:** enable/disable/pause/withdraw all write `AuditEvent`s; exports carry the consent reference.

**Data model (additive, only in this phase):**
- `LocationTrack`: tenantId, membershipId, punchId?, at, lat, lng, accuracyM, speed?, source (`plugin`/`manual`), batteryPct?, ingestedAt — indexed by (tenantId, membershipId, at); RLS.
- `TrackingEnrolment`: tenantId, membershipId, enabledAt, enabledById, consentRecordId, disabledAt, reason.
- Ingest: a server action / route called by the plugin's sync with batches; idempotent on (membershipId, at); rejects points outside the enrolment window.

**Product framing:** this contradicts the current "not continuous tracking" positioning in `catalog.ts` and the marketing copy. It must be a deliberate product decision (see `OPEN_DECISIONS.md` §1), and the lighter alternative — **visit taps** (going out / reached customer / back at office, each with a foreground fix) — already covers most of the stated need without background tracking. Recommend shipping visit taps first, measuring demand, then deciding on background tracking.

## 3. Sequencing

1. `LocationService` abstraction (web implementation = today's code) — no behaviour change.
2. Native implementation with `@capacitor/geolocation` — Android device test on check-in at the office edge, indoors, with location off, with approximate-only.
3. Visit taps (foreground) if the owner wants them — product feature, web + app.
4. Background tracking **only after** the decision, the notice version, the company/employee switches and the retention job exist — start with the community plugin on Android, measure battery over a week with 3–5 field staff, then decide on Transistorsoft, then iOS.

## 4. Testing checklist (device, not emulator)

- Permission denied, "ask every time", approximate-only, location services off, airplane mode, GPS cold start indoors.
- App backgrounded during the prompt (the watchdog case) on both platforms.
- Check-in queued offline with coordinates, then synced — server re-assessment matches what the card showed.
- Background (if built): app killed by the OS, phone rebooted, battery saver on, Doze; tracking stops exactly at the window end and on withdrawal.
