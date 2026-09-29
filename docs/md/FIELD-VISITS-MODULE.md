# FlowHRMS — Field Visits module

Version: 1.3 | Date: 29 September 2026 | Status: approved by the owner from UI mockups (29 Sept 2026). Phases 1–4 built the same day.

## 1. Why

Companies want to know where their people go during the working day: sales calls, collections, deliveries, events, meetings, banks, government offices and suppliers. Owners in particular want to see when department heads leave the office and when they come back. They also want to pay travel allowance on real distances.

All of this is done without continuous tracking. MODULES.md lists continuous location tracking as excluded, and the employee notice promises it never happens.

## 2. Invariants

1. **Location only at a tap.** Location is captured at the four taps below and nowhere else: never between taps, never in the background.
2. **Inside an open working day.** A trip happens inside an attendance day that is still checked in. Visit time and travel time are working time, so `workedMinutes` is unchanged.
3. **Owners never record visits.** Anyone holding the Owner role never records; they see everyone. Everyone else in the chosen scope may record.
4. **The company's own words.** The noun for what people visit ("place", "customer", "party", "site", …) and the list of visit purposes belong to the company.
5. **Nobody in the field waits.** Approval of "Going out" is asked for, not waited for: the trip starts at once.
6. **Snapshots.** Each row stamps the place name, the purpose name and the version of the rules that applied. Renaming a place or a purpose later never rewrites history.
7. **Distance by road.** Distance is measured by road between the tapped spots. A straight-line figure may appear only as a marked estimate until the road figure arrives.
8. **Corrections are visible.** A correction is a new, visible, audited entry, never a silent rewrite.

## 3. The four taps

| From | Tap | To |
|---|---|---|
| At the office | Going out | Out |
| At the office or Out | Reached a {place} | At a {place} |
| At a {place} | End visit | Out |
| Out | Back at office | At the office |

- **Precondition:** an open check-in. Someone who hasn't checked in is told "Check in first".
- **Skipping "Going out":** tapping "Reached a {place}" straight from the office starts the trip. Its start time is estimated from the road travel time and marked as estimated.
- **Checking out while out or at a {place}:** the app asks "Leaving {place} now?". The visit and the trip then end at the check-out, with the end marked `CHECKED_OUT`.
- **A forgotten "End visit"** can only happen when the whole day was never checked out, because the phone offers only "End visit" while someone is at a place.
- **A day that closes by itself** with a visit or trip still open marks them `NOT_RECORDED`. This happens on the next load or tap, once the check-in is open longer than a shift (`MAX_OPEN_VISIT_HOURS`).
  - Times are never invented.
  - On My day, the person can say when they left a visit and why. The visit is then recorded as `CORRECTED`, visibly and with the reason, and their reporting manager is told.
  - No distance is invented for a corrected visit.
- **Offline:**
  - Taps are queued with the phone's own time (queue kind `fieldTap`), including a photo kept as a Blob.
  - They are synced in order: after `checkIn` and before `checkOut` when times tie.
  - A repeated send of the same tap is recorded once.
  - The rule for how old or future-dated a phone time may be is shared with check-in (`resolveCapturedAt`).

## 4. Nudges to the reporting manager

- **Recipient:** the person's reporting manager (`reportingToId`). If there is none, the department head. If there is none of those either, the owners and admins, following the existing action-tile audience rules. The person is never their own recipient.
- **Going out** raises an **approval** tile (`ActionRequest` kind `FIELD_TRIP`), for example: "Rohit Das is going out. Approve?" The manager can Approve, or Decline with a reason.
  - The trip is not held up while the tile waits.
  - If "Going out" was skipped, the tile is raised at the first "Reached" tap.
- **Declined trip:**
  - It stays on the record, marked Declined.
  - Its kilometres are left out of the travel claim.
  - The person sees the decision and the reason.
- **Where the manager decides:** the tile opens `/field-visits/trips/[id]`, in the employee area, because a reporting manager may have no admin access. Approving can also be done in one tap on the tile.
- **Trip not yet decided:** it shows "Waiting for approval". Its kilometres are included in the travel claim, but flagged to whoever approves the claim.
- **Reached a {place}, End visit and Back at office** each send an **information** notification only. No action is needed.
- **Company rules** can switch either behaviour off: "Going out needs approval" and "Tell the manager at every tap". Both are on by default.

## 5. Who sees what

- **The person:** their own trips and visits.
- **A reporting manager:** the trips of their direct reports.
- **A department head:** their own department.
- **`fieldvisits.view`:** everyone. This permission is sensitive because it covers location data. By default it goes to Owner, Super Admin and Admin.
- **Where they look (Admin → Field visits):**
  - **Today:** everyone in the viewer's scope, with where each person is now (at a place, out, back, needing a correction, at the office, checked out, not in), today's visits and distance, and trips waiting for approval. It can be filtered by department.
  - **A person's day:** the map and timeline of every trip, with Approve / Decline for trips still waiting, if this viewer may decide them.
  - **Report:** a month, person by person (days out, trips, visits, time at places, time out, km by road and km still estimated, not ended, declined, awaiting). Downloading it as CSV needs `reports.export`. Typed text in the CSV is protected against spreadsheet formulas.
  - **Places:** rename, fix the pin, merge two entries for the same place (visits move, the duplicate is retired, each visit keeps its recorded name), retire and restore. Only for `fieldvisits.view`.
- **Reporting managers without admin access** (a team leader, say) decide and follow their people's trips from the tile and the trip page in the employee area.

## 6. Wording, purposes, places

- **The word for what people visit:**
  - Preset words: place (the default), customer, party, client, dealer, site and store.
  - A company may instead enter its own word: singular and plural, up to 24 characters each.
  - The chosen word is used on every button, heading and report.
- **Purposes:** the company's own list (defaults: Meeting, Event, Sales, Collection, Delivery, Service, Bank / govt office, Purchase, Other). Choosing a purpose on a visit is always optional. A purpose is retired by switching it off; old visits keep its name.
- **Places:**
  - *Saved places:* a name and an optional address. The spot is taken from the first visit. They are shared across the company and appear nearest first.
  - *One-time places:* a name only, not saved to the list.
  - *Far-away flag:* only saved places are flagged, when a visit is more than the "away from saved spot" distance from them (default 300 m). The flag informs; it never blocks.
- **Photo:** Off, Optional (the default) or Required.
- **Who records visits:** everyone except owners (the default), or only people in chosen departments.

## 7. Distance and travel claims

- **Legs:** trip start → first arrival; each departure → the next arrival; last departure → trip end.
- **Road distance:**
  - Each leg's road distance comes from the Google Routes API, called by the server with `GOOGLE_MAPS_SERVER_KEY` (a key restricted to the Routes API, entered by the owner, never committed).
  - It runs after the tap has been answered, so it never slows the tap.
  - If the call fails, a straight-line figure marked "estimated" is stored and the road figure is retried later.
  - **When it runs:** after a tap's response (Next's `after`), and again whenever a day or trip is viewed with a distance still waiting. The page then refreshes itself once.
  - **Back-off:** 1, 2, 4 … minutes, at most an hour, and 8 tries at most. After that, the leg keeps its straight-line estimate, marked as such.
  - **Short stretches:** under 50 m, no route is asked for; the straight line is the distance.
  - **Skipped Going out:** once the first stretch's road time is known, the trip's start moves back by it, never before the check-in.
  - **Kept:** the road distance and time, as the business record for travel claims. The route line for the map is dropped after 30 days (Google Maps Platform terms limit keeping route content). Legal review should confirm that keeping the distance fits those terms.
  - **What is asked for:** driving without live traffic, and only distance, duration and line, which keeps it on the basic price tier.
  - **Map:** on the trip page, the tapped spots numbered in order, with the road line, or a dashed straight line where the road isn't known. It needs the browser key `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`; without it the timeline shows alone.
  - Route lookups are paid for by Flowacord.
- **Monthly claim:**
  - Each person picks their vehicle once; an admin can change it later.
  - "Claim travel for {month}" drafts an Expenses claim in the "Conveyance" category from the month's road kilometres × the vehicle's rate.
  - There is one claim per person per month.
  - Changing the kilometres needs a reason. The approver sees both the recorded and the claimed figures, with a flag when they differ.
  - Settlement is exactly as for any claim, including payroll in whole rupees.
- **Before any claim is possible:** a company must set at least one vehicle rate.

## 8. Data (Phase 1 migration, additive)

- `field_places`: saved places (name, name key, address, spot, active).
- `field_trips`:
  - Going out → back. Start and end spots with the phone's own time, and `startEstimated`.
  - `endKind` (`BACK_AT_OFFICE` / `CHECKED_OUT` / `NOT_RECORDED`).
  - `approval` (`NOT_NEEDED` / `PENDING` / `APPROVED` / `DECLINED`) with who decided, when and why.
  - The rules version, and whether the trip was captured offline.
- `field_visits`:
  - Arrival and departure spots with the phone's own time.
  - Snapshots of the place and purpose name.
  - Distance from the saved spot and the far-away flag.
  - Note, photo path, and `endKind` (`ENDED` / `CHECKED_OUT` / `NOT_RECORDED` / `CORRECTED`).
- `field_legs`: from and to spots and times, road metres and seconds, method (`ROAD` / `STRAIGHT`), status (`PENDING` / `DONE` / `FAILED`), encoded route line, attempts.
- **New enum value:** `ActionRequestKind` gains `FIELD_TRIP`.
- **Row-level security:** all four tables are in `scripts/setup-rls.ts`. `src/lib/platform/purge.ts` deletes them with the company.
- **Rules:** the company's rules are a versioned `tenant_policies` document under the key `field_visits`.

## 9. Privacy notice changes

These are drafts for legal review. They were written with Phase 2 and are published (`npm run publish-notices`) immediately before it deploys:
- employee notice v3
- company terms v2
- Terms of Service v2
- Privacy Policy v2

- **Employee notice v3.** The location item becomes: "Your location — only at the moment you check in and check out and, if your company uses field visits, when you tap Going out, Reached, End visit or Back at office. Never continuously, and never between taps."
  - A separate, optional consent is added (`visit_location`). It is never pre-ticked. It can be given or taken back in one tap, from the visit card ("Share location at visit taps") or from Account → Privacy & consent.
  - If someone withdraws that consent, their visits are recorded without location. There is then no road distance, so a travel claim has to be entered by hand with a reason.
- **Privacy policy §4, Terms and customer terms:** the same addition.
- **Effect:** publishing makes every employee accept the employee notice once more, and every owner accept the company terms once more, through the existing consent screen.

## 10. Phases

1. **Foundation, switched off (built).**
   - The module and its dependency on Attendance.
   - The permission, the four tables, the `FIELD_TRIP` kind, row-level security and purge.
   - The rules and their editor at Settings → Field visits, with tests.
   - This document.
2. **Recording on the phone (built):**
   - The home card with the four taps.
   - Choosing a place (saved, new, one-time), purpose, photo and note.
   - Nudges to the reporting manager.
   - The check-out and day-close rules, the offline queue, and the "My day" page.
   - Notices v3 published.
   - Until Phase 3, each stretch of road shows a straight-line estimate between the tapped spots, marked "about".
3. **Road distance (built):** the Routes API, estimates and retries, and the route map.
4. **Owner and department head views (built):** Today, a person's day, the monthly report with CSV, and the places list.
5. **Monthly travel claim:** vehicles, the Conveyance claim, km edits with a reason, and the approver's comparison.

## 11. Open points

- Legal review of the §9 wording.
- Whether a trip still undecided at month end should be included in the claim, flagged (the current proposal), or left out until decided.
