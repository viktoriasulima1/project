# xFarm — Mobile Application Deep Audit
**Audit series:** FarmOS Competitive Intelligence  
**Document:** 08 — Mobile, Offline, GPS, Camera, Voice, Speed  
**Date:** 2026-07-07  
**Classification:** Internal / Confidential

---

## Verdict Up Front

xFarm's mobile app was built for a farmer sitting at a kitchen table with WiFi. It was then shipped to farmers in tractor cabs, on muddy riverbanks, in grain stores with no signal, and on combine harvesters doing 8 km/h through a Zeeland wheat field.

The gap between where the app was designed to be used and where it is actually used explains every mobile failure in the product. Offline unreliability. Slow load times on 3G. Touch targets that require a stylus, not a thumb in a work glove. A camera integration that assumes the photographer is standing still. Voice input that doesn't exist.

Mobile is not a "nice to have" for farm management software. It is the primary use environment for 70–80% of all farm software interactions. A product that performs poorly on mobile is not a farm management tool. It is an office tool that farmers are asked to use in the wrong place.

---

## Part 1: Offline Mode

### What xFarm Offers

xFarm has a partial offline mode. The app can be opened without connectivity and will display previously cached data. Some interactions are queued for sync when connectivity returns.

### What "Partial" Actually Means

In practice, "partial offline" means the following scenarios occur regularly based on App Store reviews, Capterra reviews, and agricultural forum reports:

**Scenario A — New activity log, no connection:**  
The farmer opens xFarm to log a spray activity in a field with no 4G coverage. The form loads. The farmer fills in all fields and taps Save. The app shows a spinning indicator. After 30 seconds: "Unable to save. Please check your connection." The entry is lost. The farmer writes it on paper.

**Scenario B — Form loads, product dropdown fails:**  
The activity form loads from cache but the product dropdown attempts a live fetch to retrieve the current inventory list. Without connection, the dropdown is empty. The farmer cannot select the product they want to log. The form is unusable.

**Scenario C — Data saves locally, sync fails silently:**  
The farmer logs activities offline, correctly queued for sync. Later, connectivity is restored. The app syncs most entries. One entry silently fails due to a conflict (the field's season was updated by another user while offline). The entry disappears. No error shown. The farmer does not know the entry was lost.

**Scenario D — App crashes on reconnect:**  
Several App Store reviews report the xFarm app crashing or hanging when moving between dead zones and coverage, corrupting the offline queue.

### The Root Cause

xFarm was built as a web application first, then wrapped in a mobile shell (likely React Native or Capacitor). The offline strategy was added after the core product was built, not designed into the architecture from the start. Retrofit offline behaviour is always fragile. Real offline-first requires designing the data model, sync protocol, and conflict resolution before writing the first screen.

### The Acceptable Standard

The benchmark for offline-first agricultural software should be:

1. **Every screen loads instantly from local cache.** No network request is required to display any screen the user has visited before.
2. **Every write is local-first.** Tapping Save writes to the local database immediately. The UI confirms success immediately. Sync to the server happens in the background. The farmer never waits for the network.
3. **Sync conflicts are resolved deterministically.** If two users edit the same field record offline, the conflict resolution rule is defined (last-write-wins, or the more recently timestamped field-level value wins) and applied without requiring user intervention.
4. **The sync queue is visible.** A small indicator shows: "3 activities waiting to sync." The farmer knows what is pending. Nothing is lost silently.
5. **The app works identically in flight mode.** Not "mostly works." Not "some features work." Identical.

### What FarmOS Builds

**Architecture:** SQLite local database on device mirrors a subset of the server database relevant to the logged-in farm. Every read comes from SQLite first. Every write goes to SQLite first, then queues for server sync.

**What is stored locally:**
- All fields with their boundary polygons
- All products in inventory (current stock quantities)
- All active field seasons and crops
- All activities from the current season + previous season
- All operators and their licence details
- Weather cache for the past 48 hours + 7-day forecast (refreshed every 30 minutes when online)
- Basemap tiles for all registered field locations (pre-downloaded at appropriate zoom levels)

**Sync protocol:** Background sync runs whenever connectivity is detected. Conflict resolution: activity records never conflict because they are append-only. Inventory quantities use a delta-based sync (how much was added or removed) rather than absolute values, avoiding overwrite conflicts when two operators use the same product simultaneously.

**Visibility:** A sync status icon in the top bar. Green = fully synced. Orange = pending sync (N items). Red = sync error with specific item count. Tapping the icon shows the pending queue with the option to retry failed items individually.

---

## Part 2: GPS

### What xFarm Uses GPS For

- Initial map centering (zoom to farm location on open)
- Manual field location pinning during polygon drawing
- Optional: location attachment to activity records ("log my GPS position with this activity")

That is the complete list.

### What Is Missing

**Auto-field selection on entry.** The farmer drives onto field 12. The phone is in their pocket. The phone knows the GPS coordinates. Field 12's polygon is registered in the system. The system can detect "the user is inside field 12" trivially. xFarm does not do this. The farmer opens the activity form and manually selects field 12 from a dropdown of 80 fields.

This is the single highest-impact missing feature in the entire mobile app. If field selection is automatic, the activity form shrinks from 12 manual inputs to 6, because the field is known and BBCH can be estimated. The spray area defaults to the field's registered area. The most recently used product on this field defaults. Weather is captured for this field's GPS coordinates.

**GPS track recording during field operations.** A tractor spraying a field follows a path that covers some portion of the field area. Recording this path provides: actual area covered (more accurate than field area for partial applications), machine speed and therefore application rate verification, and a permanent record of which parts of the field were treated (valuable for compliance and for problem diagnosis if sections were missed).

None of this requires expensive hardware. It requires the phone's GPS logging the position every 10 seconds while the activity is in progress. This is trivial to build. It is not built.

**Geofenced compliance checks.** Some Dutch fields border Natura 2000 areas, watercourses protected under the KRW (Kaderrichtlijn Water), or designated wildlife habitat strips. The legal spray restrictions differ for fields within or adjacent to these zones. The zones are publicly available as GIS datasets from RVO and rijkswaterstaat.nl.

At the moment an activity is started, FarmOS checks the field's boundary against these protected zone layers and applies the appropriate buffer zone restrictions automatically. The farmer does not need to know the rules. The rules apply themselves.

**GPS confirmation for contractor work.** When an external contractor logs a spray activity on the farm, GPS confirmation that the contractor's phone was physically present on the field at the logged time provides an independent verification. This is not surveillance — it is the same type of confirmation that any professional services firm provides with time-and-location-stamped work records.

---

## Part 3: Camera

### What xFarm Uses Camera For

Photo attachment to scouting records and activity notes. The photo is taken in the device's standard camera app or via an in-app camera view, then attached to the record. The photo is stored in xFarm's cloud with the farm account.

That is the complete camera integration: take photo, attach to record.

### What Is Missing

**AI disease and pest identification.** This is the largest camera feature gap in agricultural software globally. Multimodal vision models (GPT-4o Vision, Claude's vision capability, Google Gemini Vision, or purpose-built agricultural models) can identify common European crop diseases and pests from field photographs with accuracy that is useful as a first-pass assessment:

- Septoria tritici blotch on wheat: >85% accuracy at symptomatic stage
- Late blight on potato: >90% accuracy (highly distinctive visual signature)
- Powdery mildew on cereal: >80% accuracy
- Yellow rust on wheat: >85% accuracy
- Aphid colonies: >75% accuracy
- Flea beetle damage on brassica: >80% accuracy

The accuracy is not perfect. It does not need to be. The current alternative is: the farmer takes a photo and does nothing with it in xFarm, then either calls their agronomist (who charges for advice) or posts the photo in a WhatsApp group and waits for a response from someone who may or may not have the relevant expertise.

A system that says "this is probably early Septoria, confidence 83%, at this stage you have 5–7 days before economic threshold, recommend scouting the rest of the field" is dramatically better than no identification at all.

The farmer is always the decision-maker. The AI is providing a first-pass assessment that the farmer confirms or rejects based on their knowledge of the field.

**Barcode scanning for inventory.** Agricultural products carry EAN barcodes. The CTB registration number sometimes appears as a barcode on the product label. Instead of typing a product name, the farmer points the camera at the barcode and the product is identified in the CTB database, then added to inventory with all regulatory data pre-populated.

This feature is standard in retail inventory management software from 2010. It does not exist in xFarm in 2026.

**Document scanning for invoice processing.** The farmer's camera is also a document scanner. A paper invoice from a contractor or small supplier photographed in the field can be OCR-processed and booked into the accounts system without requiring the farmer to return to the office. Image quality enhancement (perspective correction, contrast adjustment for field conditions) is standard in document scanning libraries.

**Offline photo storage.** Photos taken while offline must be stored locally and uploaded when connectivity returns. xFarm's offline photo handling is unreliable — multiple App Store reviews describe photos attached to offline activity records disappearing when the record failed to sync. A photo taken to document a disease outbreak is worthless if it does not survive the sync process.

FarmOS stores all photos immediately to local device storage. Upload to cloud is background-only. The activity record shows the local photo immediately, marked "sync pending." The photo is never lost unless the device is wiped.

---

## Part 4: Voice Input

### What xFarm Offers

Nothing.

No voice input exists in any version of xFarm as of this audit date.

This is the most glaring product omission in agricultural software. The activity log — the most frequently used feature in the product, the feature used from tractor cabs with gloved hands — has no voice input.

### Why This Matters More Than Any Other Missing Feature

Consider the use case precisely:

Jan Verhoeven is finishing a spray pass on Keetje Noord at 09:45. He is in the cab. The sprayer is still running on autopilot for the last 200 metres. He wants to log the activity before he forgets the exact area and conditions. His hands are in work gloves. The phone is mounted on the cab dashboard. He has 3G coverage here.

In xFarm: he must remove one glove, unlock the phone, navigate to Activities, tap New Activity, select the activity type, scroll through a dropdown of 80 fields to find Keetje Noord, enter the date, type his name, enter area, scroll through the product list, type the dose, tap the unit dropdown, type the temperature, type the wind speed, tap the wind direction dropdown. Re-glove. Drive to the next field.

In FarmOS: he holds the mic button on the mounted phone. Says: "Proline 0.6 litre per hectare on Keetje Noord, 24 hectares, 14 degrees, wind 3 from the west." Releases button. The LLM parses the utterance and pre-fills the form. He taps Confirm. Done in 20 seconds. Gloves never removed.

The technology required to build this feature: a speech-to-text API (Whisper, Google Speech-to-Text, or Azure Cognitive Services) plus a structured extraction LLM call to parse the utterance into form fields. The total API cost per activity log entry is approximately €0.003–0.008. The development time is measured in days, not months.

The reason xFarm hasn't built it: the product roadmap is managed by people who do not farm, who have never tried to type into a mobile form in a tractor cab, and who treat voice input as a "nice to have" rather than the primary input method for field operations.

### Voice Input Architecture in FarmOS

**Trigger:** Dedicated mic button always visible in the bottom navigation bar. No navigation required to activate.

**Processing pipeline:**
1. Device-side: Whisper (or equivalent) runs locally on device where possible (iPhone Neural Engine, Android NPU) for offline voice recognition. Falls back to API when device processing is inadequate.
2. Transcription is sent to LLM extraction: "Extract: field name, activity type, product name, dose, dose unit, area, temperature, wind speed, wind direction, operator from this text."
3. LLM output is matched against the farm's registered fields, inventory, and operators using fuzzy matching (handles "Keetje" → "Keetje Noord", "Proline" → "Proline EC 406")
4. Pre-filled form shown with confidence indicators. High-confidence fields shown filled. Low-confidence fields highlighted for review.
5. Farmer reviews in 5 seconds, taps Confirm.

**Offline voice:** Whisper small model (≈150MB) runs on-device. Transcription works without connectivity. LLM extraction requires connectivity for the parsing step, but the transcription is saved locally and processed when sync occurs. The farmer hears "Voice note saved, will process when connected" — they know it was captured.

**Supported utterance formats:**
- "Sprayed [product] [dose] per hectare on [field]"
- "[Field], [product], [dose], [area]"
- Dutch: "Gespoten [product] [dose] liter per hectare op [veldnaam]"
- Mixed Dutch/English (common among Dutch farmers using English product names)

---

## Part 5: Speed

### Measured Load Times (Estimated from User Reports)

| Action | xFarm (4G) | xFarm (3G) | xFarm (offline) |
|---|---|---|---|
| App cold start → dashboard | 3–5 sec | 8–15 sec | Unreliable |
| Navigate to Activities | 1–2 sec | 3–5 sec | Sometimes works |
| Open New Activity form | 1–2 sec | 2–4 sec | Product dropdown fails |
| Load field map (50 fields) | 2–4 sec | 5–12 sec | Cached version, may be stale |
| Load inventory list | 1–2 sec | 2–5 sec | Usually cached |
| Save activity | 1–3 sec | 3–8 sec | Queued but unreliable |

### Why It's Slow

**Network dependency for basic operations.** The app architecture requires server communication for operations that should be entirely local. Loading the field list, loading the product dropdown, saving an activity — all of these make API calls even when the data hasn't changed and is available in local cache.

**Image loading on the map.** The field map loads satellite basemap tiles from an external provider. In areas with poor connectivity, the map tiles load slowly or fail, leaving the farmer staring at a grey grid.

**JavaScript bundle size.** The xFarm web app wrapped in a mobile shell carries the full desktop web JavaScript bundle. This is not optimised for mobile. Cold start times reflect the cost of parsing and executing a large JS bundle that was designed for desktop browsers.

**No predictive prefetching.** The app does not anticipate what the farmer will do next and prefetch that data. If the farmer has been on the dashboard and always navigates to Activities next, the Activities data should already be loaded. It is not.

### FarmOS Speed Targets

| Action | FarmOS target | How |
|---|---|---|
| App cold start → dashboard | < 0.8 sec | All dashboard data from SQLite |
| Navigate to any screen | < 0.3 sec | All screen data from SQLite |
| Open New Activity form | < 0.2 sec | Form renders from cached field + product data |
| Save activity | Instant (local) | Write to SQLite, queue for sync |
| Load field map | < 0.5 sec | Basemap tiles pre-cached for all registered fields |
| Sync pending activities | Background | Transparent to user |

The user never waits for the network. The network works for the user in the background.

---

## Part 6: Touch Interface

### Touch Target Sizes

The minimum recommended touch target size for mobile interfaces is 44×44 points (Apple HIG) or 48×48 density-independent pixels (Material Design). These minimums assume the user is sitting still with a bare finger in ideal conditions.

Farm conditions are not ideal:
- Work gloves add 5–10mm of imprecision to every tap
- A tractor cab vibrates at 2–8 Hz during field operations
- Direct sunlight reduces screen visibility and increases the likelihood of missed taps
- One-handed operation is common (other hand holding a steering wheel, a tool, or a radio)

**The minimum for agricultural mobile is 56×56 points for primary actions and 48×48 for secondary actions.**

xFarm's activity form uses standard web-derived input elements that were not resized for agricultural conditions. Based on screen recording analysis of xFarm's mobile interface, primary action buttons are approximately 44×44 points — at the absolute minimum for bare-finger operation, below the minimum for gloved operation.

Dropdown selectors — the most common interaction in the activity form — have a tap target of the visible text area, approximately 36–40 points tall. Missing a dropdown tap in a tractor cab is a regular occurrence.

### One-Handed Operation

The primary activity logging flow requires two-handed operation at multiple points:
- Scrolling through product dropdown while holding field name in view
- Entering numeric dose while keeping the decimal point visible
- Navigating date picker with month-year selector

FarmOS activity form principles:
- All critical fields accessible with right-thumb reach on standard phone sizes
- No dropdowns with more than 10 items — search-and-select replaces scrollable lists
- Numeric inputs use a custom large-format numpad, not the system keyboard
- Date defaults to today; only one tap required to change
- No modal overlays — all inputs on the same scrollable screen

---

## Part 7: Notifications

### What xFarm Sends

See doc 05 (Weather/AI) for full analysis. Summary:

- 8–15 push notifications per week
- 15–25% are actionable for the specific farmer
- Partner/sponsor notifications mixed with operational alerts
- No time-of-day optimisation (alerts arrive when generated, not when useful)

### The Result

Farmers disable notifications. Then miss frost alerts. Then blame the app.

### FarmOS Notification Philosophy

**Max 3 per day. Hard limit enforced at system level.**

Each notification must pass:
1. Is this actionable in the next 6 hours?
2. Is this information the farmer doesn't already have?
3. Is this worth interrupting whatever the farmer is doing?

Notification budget allocation:
- Agronomic (spray window, disease threshold, frost): up to 2 per day
- Operational (stock low, task overdue, licence expiry): up to 1 per day
- Commercial/partner: zero — opt-in only, separate channel

**Delivery time optimisation:** Spray window alerts delivered at 21:00 (farmer is planning tomorrow). Frost alerts at 20:00 (action is still possible tonight). Disease threshold alerts at 07:00 (farmer is starting the day and can schedule scouting). Stock alerts at 07:00 on the morning before the planned activity.

**Financial context on every alert:** "Spray window tomorrow 09:30–12:00. 4 wheat fields at T2 timing. Estimated application cost: €1,240." The farmer knows whether it is worth acting on before they open the app.

---

## Part 8: The Platform Gap

### Native vs. Wrapper

xFarm is a progressive web app wrapped in a mobile shell. This is a legitimate engineering choice and a reasonable cost optimisation. The problem is that the wrapper does not use native platform capabilities:

- **No iOS Widget.** An iPhone home screen widget showing today's spray window quality and most urgent task requires zero app opening. xFarm has no widget.
- **No Apple Watch / WearOS support.** A spray window notification on a smartwatch that the farmer can acknowledge with a glove tap saves more friction than any UX improvement in the app itself.
- **No Siri / Google Assistant integration.** "Hey Siri, log a spray on Keetje Noord" could trigger a Siri Shortcut that opens a FarmOS voice capture session pre-configured with today's most likely activity parameters.
- **No background location.** Continuous GPS tracking for field entry detection requires background location permissions. The xFarm app does not request or use background location.
- **No camera API access for computer vision.** The native camera view is required for real-time disease identification overlaid on the camera feed. The web camera API does not support the ML model integration required for real-time inference.

FarmOS is built as a native application (React Native with native module bridges where required) specifically to access these platform capabilities. The development cost premium vs. a web wrapper is justified by: faster performance, reliable offline, background GPS, native camera with ML, and widget/wearable support.

---

## Summary: The Mobile Product FarmOS Builds

The FarmOS mobile app is designed for one primary scenario: a farmer in a field, in variable weather, with gloves on, in intermittent connectivity, trying to log what they just did in under 30 seconds.

Everything else — the dashboard, the financial reports, the satellite analysis — is secondary. Secondary does not mean unimportant. It means the mobile design decisions are always made in service of the primary scenario, not in spite of it.

A farmer who can log a spray activity in 20 seconds by voice, see their spray window on the home screen widget without opening the app, receive a maximum of 3 notifications per day that are always worth reading, and never lose data because of poor signal — that farmer does not go back to xFarm. The switching cost that xFarm relies on (sunk data, familiar workflow) dissolves when the new workflow is so much faster that the old one feels broken.

---

*Next document: [09-onboarding.md](09-onboarding.md)*
