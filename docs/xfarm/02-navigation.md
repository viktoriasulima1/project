# xFarm — Every Screen, Audited
**Audit series:** FarmOS Competitive Intelligence  
**Document:** 02 — Navigation & Screen-by-Screen Analysis  
**Date:** 2026-07-07  
**Classification:** Internal / Confidential

---

## Verdict Up Front

xFarm has 14 primary sections and roughly 60–80 distinct screens depending on crop type and account tier. The navigation was designed by someone who had never farmed. It is organised around software categories (Inventory, Reports, Settings) rather than farmer workflows (What do I do today? What did I spray last week? Am I compliant?). A farmer opening xFarm at 06:00 in a tractor cab must navigate three levels deep to log a spray activity. That is a product that does not respect its user's time.

Every screen below is scored on: **frequency of use**, **farmer value**, and **what FarmOS must do differently**.

---

## 1. Dashboard

### What It Is
The home screen. Shows a map of all farm fields, a weather strip, recent activities, active tasks, and NDVI thumbnail thumbnails if the user has satellite access.

### Why It Exists
Central orientation — prove to the farmer that the app knows about their farm and is "working." Also serves as the demo screenshot used in every sales deck and cooperative pitch.

### How Often a Farmer Uses It
Every session — it is the landing page. But "using" and "getting value" are different things. Most farmers glance at it and immediately navigate away to log an activity or check weather. The dashboard is a wayfinding screen, not a decision screen.

### Weaknesses

**It is backward-looking.** Every widget on the xFarm dashboard tells you what happened. Weather happened. Activities happened. Satellite imagery captured what the field looked like 5 days ago when there was no cloud cover. A farmer needs to know what to do **now** and **next**, not what occurred.

**The map is decorative, not interactive.** Clicking a field on the dashboard map navigates to that field's detail page — but the map does not answer the question farmers are actually asking at 06:00: "Which of my fields needs attention today?" There is no risk layer, no urgency indicator, no "these 3 fields are at T2 flag leaf and need fungicide this week" overlay.

**Widget overload.** The dashboard shows 7–9 widgets simultaneously. A farmer with 80 fields, 4 active crops, and a sprayer scheduled for today gets the same dashboard as a farmer with 2 fields and one crop. There is no personalisation. The information is generic, and generic information is noise.

**NDVI is shown even when it is useless.** The Netherlands has significant cloud cover for 60–70% of the growing season. Sentinel-2 optical imagery cannot penetrate clouds. xFarm shows the NDVI widget regardless — displaying a 12-day-old image as if it is current intelligence. This erodes trust.

**No financial pulse.** A farm is a business. The dashboard shows zero financial information — no YTD cost vs. budget, no cash position, no next invoice due. The farmer's bank manager has more relevant financial information than their farm management software.

### What FarmOS Does Better
The FarmOS dashboard is a **decision brief**, not a data display. Maximum 3 items surface at any time: the single most urgent agronomic action today, the spray window quality (scored 0–100), and one financial signal (cost vs. budget deviation). Everything else is available on demand. The farmer who opens FarmOS at 06:00 knows in 8 seconds what they need to do. In xFarm they know in 8 seconds that the app has loaded.

---

## 2. Fields (Percelen)

### What It Is
A list and map view of all registered agricultural parcels. Each field has: name, area (hectares), soil type, current crop, current season assignment, and access to that field's history.

### Why It Exists
The field is the atomic unit of farming. Everything else — activities, costs, compliance records, satellite imagery — is attached to a field. This screen is the master registry.

### How Often a Farmer Uses It
Several times per week during active growing season; mostly for navigation to a field's detail. The list view is rarely used directly — farmers navigate by map.

### Weaknesses

**Manual field creation is the worst experience in the product.** Drawing polygon boundaries on a mobile map in a tractor cab is approximately impossible. The map tools are imprecise. The save flow requires confirmation steps that assume the user has two hands free and stable connectivity. Dutch farmers have spent hours on this screen trying to draw field boundaries that match their actual parcel edges.

**No national registry integration.** The Netherlands has the BRP (Basisregistratie Percelen) — a public API maintained by RVO that contains the registered GPS boundaries of every agricultural parcel in the country. Germany has the FLIK system. France has the RPG. xFarm does not import from any of these. A Dutch farmer registering 80 fields draws 80 polygons by hand when the government already has all of this data available via API. This is not a technical limitation — it is a product decision that was never made. The result is 4+ hours of setup work that should take 4 minutes.

**Field card shows historical data, not current status.** The field detail page shows last year's yield, historical activity count, and NDVI from whenever the last cloud-free image occurred. It does not show: days since last spray, current BBCH growth stage, nitrogen applied vs. limit, or next scheduled activity. These are the questions farmers ask about a specific field every week.

**Soil type is a free-text field in some markets.** Type "klei" (clay in Dutch), "clayey", or "heavy clay" and xFarm treats them as three different soil types. This corrupts every soil-type-dependent recommendation downstream.

**No PCN (Potato Cyst Nematode) history.** Dutch potato farmers are legally required to test fields for PCN before planting potato. This history lives in paper binders or separate databases. xFarm has no field-level PCN record. A farmer using xFarm as their "complete farm management system" still maintains a separate PCN binder.

**Deleted fields are gone.** If a farmer deletes a field by mistake — or more commonly, if a farm worker deletes a field thinking they're removing a duplicate — all historical activities, spray records, and compliance data linked to that field becomes inaccessible. There is no soft-delete, no archive, no recovery flow. This is a data integrity failure on a compliance-critical system.

### What FarmOS Does Better
Field creation in the Netherlands takes 60 seconds via BRP API import. Fields arrive pre-populated with official boundaries, area, and cadastral reference number. The field detail screen surfaces what matters now: current BBCH (auto-calculated from planting date + KNMI degree days), nitrogen applied vs. legal limit, and the next scheduled activity. Deleted fields are soft-deleted — data is preserved, the field is archived.

---

## 3. Activities (Logboek / Werkzaamheden)

### What It Is
The activity log — a chronological record of every farm operation: spraying, fertilising, sowing, harvesting, tillage, irrigation. Each entry captures field, date, operator, product, dose, area, and for spray activities, weather conditions at time of application.

### Why It Exists
This is the compliance core. The EU Sustainable Use of Pesticides Directive and Dutch RVO requirements mandate electronic records of all pesticide applications. Without this module, xFarm has no product. Every other module exists in support of, or adjacent to, this one.

### How Often a Farmer Uses It
Daily during spray season (April–October for most Dutch arable crops). Multiple times per day during peak periods (pre-harvest fungicide programs on wheat, sugar beet cercospora spray rounds).

### Weaknesses

**7–9 taps to log a single spray activity.** Counted from the Activities screen: tap Add → select activity type → select field → enter date → enter operator → enter area → select product → enter dose → enter dose unit → enter weather → save. This is before the Dutch-specific mandatory fields: certificate number (spuitlicentie), nozzle type, water volume per hectare. A farmer spraying 4 fields in a day enters this form 4 times. At 8 taps per form plus typing, each log takes 3–5 minutes on a mobile in a cab.

**No voice input.** Logging "I sprayed Proline 0.6 litres per hectare on Keetje Noord this morning, wind was 3 metres per second" as a voice note that auto-populates a form does not exist in xFarm. This feature has been requested for 5 years and never built. The technical barrier is low. The product decision was never made.

**Smart defaults do not exist.** If Jan Verhoeven sprays field 12 every Tuesday for 6 consecutive weeks with the same product and dose, xFarm remembers nothing. Every Tuesday Jan starts with a blank form. The app has access to his entire spray history and uses none of it to pre-populate the next entry.

**Weather capture is manual.** The form has fields for temperature, wind speed, and wind direction. The farmer types these in. xFarm knows the GPS location of the field. It has a weather API integration. It does not automatically capture weather conditions at the logged time and location. The farmer must open a weather app, note the conditions, switch back to xFarm, and type them. This defeats the entire purpose of having a digital system.

**No offline reliability.** Rural Dutch polders — Zeeland, Groningen clay, Flevoland — have known 4G dead zones. Farmers try to log activities from the cab and discover xFarm either cannot save or silently queues entries that fail to sync. Multiple reported cases of data loss on the App Store and Capterra. For a compliance system where lost data means regulatory non-compliance, this is not an inconvenience — it is a product-disqualifying failure.

**Duplicate detection does not exist.** If a farmer logs the same field twice on the same day with the same product, xFarm accepts both entries without warning. Duplicates corrupt compliance reports and give a false picture of stock consumption.

**No cross-field bulk logging.** Spraying the same product across 6 contiguous fields in one pass is a single tractor trip. xFarm requires 6 separate activity entries. There is no "apply this activity to multiple fields" workflow.

### What FarmOS Does Better
Two-tap logging from the cab: field is pre-selected by GPS. Product defaults to last used. Weather auto-captured from cached KNMI data at the field location. One tap to confirm, one tap to save. Voice alternative available from any screen in 2 seconds. Full offline support — entries queue locally and sync silently. Bulk field selection for multi-field activities. Duplicate detection with merge suggestion.

---

## 4. Inventory (Voorraad)

### What It Is
A stock management module for agrochemical products, seeds, fertilisers, and other consumables. Tracks: current stock level, product details, unit of measure, location, and movement history.

### Why It Exists
To prevent running out of product mid-spray campaign and to provide traceability of what was purchased vs. used. Also required for compliance: you must be able to prove you held the registered product that you claim to have applied.

### How Often a Farmer Uses It
Weekly check during active spray season; monthly review the rest of the year.

### Weaknesses

**Entirely manual.** Every product must be added by hand: product name, registration number, unit, initial stock level. A farm with 40 SKUs in inventory spends 2 hours entering everything. There is no barcode scanning. There is no supplier API integration. There is no way to import from an Agrifirm purchase history PDF.

**Stock deduction is unreliable at scale.** When an activity is logged that uses a product, xFarm should automatically deduct the used quantity from the product's stock. This works in simple cases. In complex cases — partial field application, dose adjustment mid-field, retroactive activity entry — the deduction either fails silently or creates impossible negative stock values.

**No reorder intelligence.** xFarm can show you that you have 8 litres of a product remaining. It does not tell you whether that is enough for your planned activities this week. It does not trigger a reorder alert when stock falls below a threshold relative to your spray program requirements. A simple calculation (planned ha × dose per ha = required litres; current stock − required litres = shortfall) is never surfaced.

**No expiry date tracking.** Pesticide products have label expiry dates and storage requirements. A product stored past its expiry date cannot legally be applied. xFarm does not track expiry.

**No purchase price tracking.** The cost of inputs is one of the largest variable costs on an arable farm — often 30–40% of total production cost. xFarm tracks quantities but not prices. This makes it impossible to calculate true per-hectare input costs from within the product.

### What FarmOS Does Better
Barcode scanning for rapid product entry. Agrifirm/De Groot invoice OCR to auto-import purchased stock. Real-time stock sufficiency check: "You have 45L of Proline. Your planned spray program this week requires 54L. Order 15L?" Reorder alert linked to preferred supplier. Expiry date tracking with compliance warning 30 days before expiry.

---

## 5. Weather

### What It Is
A weather display page showing current conditions, a 7-day forecast, and in paid tiers, an agricultural weather interpretation layer with spray window indicators and frost/disease risk alerts.

### Why It Exists
Weather is the single most important external variable in farming. Spray timing, harvest timing, cultivation timing, irrigation decisions — all depend on weather. Farmers check weather multiple times per day. This module exists to keep them in the app rather than switching to Buienradar or Weeronline.

### How Often a Farmer Uses It
Multiple times daily. The weather screen is the most-used screen in xFarm that is not the activity log. It is also the clearest example of the gap between what xFarm promises and what it delivers.

### Weaknesses

**It shows weather. It does not answer farming questions.** The screen displays temperature, wind speed, precipitation probability, humidity, UV index. A Dutch farmer staring at this screen at 06:00 needs to answer one question: "Can I spray today?" xFarm gives them raw data and makes them do the calculation themselves. Wind speed 6 m/s at 09:00 dropping to 3 m/s at 11:00; temperature 14°C; relative humidity 72%; rain tomorrow afternoon at 16:00. Is 11:00–14:00 a valid spray window? For which products? At what maximum wind speed? xFarm does not answer this.

**No soil temperature.** Herbicide efficacy depends heavily on soil temperature (most pre-emergence herbicides need soil above 5°C to be activated). Cultivation timing depends on soil temperature and moisture. xFarm shows air temperature only.

**No growing degree day accumulation.** BBCH growth stage estimation from thermal time is standard agronomy. xFarm doesn't show it.

**No dew point calculation.** Dew point determines condensation risk (relevant for fungal disease spread, spray evaporation, and minimum safe spray temperature). Not shown.

**Location resolution is inadequate.** Weather is retrieved for a GPS point near the farm. A Dutch farm spanning 300 ha across two polders may have meaningfully different weather at opposite ends of the farm. xFarm shows one weather reading for the entire operation.

### What FarmOS Does Better
The weather screen answers **one primary question** per session: "What is the quality of today's spray window?" Scored 0–100. Broken down by 30-minute intervals. Factors included: wind speed vs. product label limits, temperature vs. product minimum, dew point risk, rain forecast within re-entry interval, operator label requirements. Supporting data (raw temperature, precipitation, wind) is one tap deeper. Soil temperature from nearest KNMI station shown prominently. Growing degree day accumulation shown per crop/field.

---

## 6. Machinery (Werktuigen)

### What It Is
A registry of farm equipment: tractors, sprayers, combines, cultivators. Each machine has: name, type, year, service intervals, and maintenance log.

### Why It Exists
Equipment is a major capital asset. Tracking service intervals prevents breakdowns. Linking sprayer records to the spray diary satisfies EU sprayer inspection requirements (machines must be professionally inspected every 3 years in the Netherlands).

### How Often a Farmer Uses It
Rarely. Monthly at most to log a service. Seasonally to update the sprayer inspection certificate date.

### Weaknesses

**Entirely static.** The machinery module is a registry, not an intelligence system. It tells you what machines exist. It does not tell you: fuel consumed per field (calculable from GPS track + engine hours), cost per hectare by operation type, when the next service is due (it shows the interval but does not alert proactively).

**No telematics integration.** John Deere Operations Center, CLAAS telematics, CNH My CNH Connect all have APIs that export: GPS tracks, engine hours, fuel consumption, operational speed, PTO engagement, header height data. xFarm has no integration with any of these. A farmer with a connected tractor manually re-enters into xFarm what their tractor already recorded automatically.

**Sprayer calibration log is absent.** Dutch law requires sprayers to be calibrated and the calibration documented. xFarm has a field for the inspection certificate expiry date but no structured calibration log (nozzle type, nozzle wear measurement, sprayer output test results, date of calibration).

**Cost allocation is missing.** If the sprayer runs for 3 hours on field 12, what did that cost? Fuel price × litres consumed = cost. This is calculable. xFarm never surfaces it.

### What FarmOS Does Better
Machine cost calculation: record fuel price, track engine hours per field from telematics or manual entry, surface cost per hectare per operation type. Sprayer calibration log as a structured form, not a text field. Proactive service alerts 2 weeks before the interval is due. John Deere Operations Center integration for automatic GPS track and engine hour import (Phase 2).

---

## 7. Finance (Financiën)

### What It Is
A basic income and expense tracking module. Allows manual entry of costs (categorised by type) and revenues (crop sales, subsidies). Shows budget vs. actual by category. Generates a basic P&L summary.

### Why It Exists
To justify xFarm's "farm management" positioning. A management system that doesn't manage finances isn't managing the farm — it's managing compliance records.

### How Often a Farmer Uses It
Irregularly. Monthly if at all. Most Dutch farmers who use xFarm do their financial administration in Exact, Boekhoud Gemak, or via their accountant's spreadsheet. xFarm's finance module is used by farmers who want a rough overview without maintaining proper books — which is nearly every farmer until the accountant asks for the real numbers.

### Weaknesses

**This module should not exist in its current form.** A manual-entry income/expense tracker in 2026 is not a financial management feature. It is a worse version of an Excel spreadsheet, with the added downside that it is not where the farmer's accountant expects the numbers to be.

**No bank account integration.** PSD2/Open Banking has been live in the EU since 2019. Dutch farmers bank with Rabobank (85% market share in agriculture), ABN AMRO, or ING — all of which have PSD2-compliant open banking APIs. xFarm does not connect to any of them. Every euro of income and expense is manually entered.

**No per-field P&L.** The single most valuable financial metric for an arable farmer is net margin per hectare per field. "Keetje Noord earned €287/ha margin last year; Achterste Kamp lost €43/ha." This drives every rotation, rental, and capital investment decision. xFarm cannot calculate this automatically because it does not link financial transactions to specific fields. The farmer would have to manually code every cost to a field, which nobody does.

**No subsidy tracking.** Dutch CAP (GLB) basic payments, eco-scheme premiums, agri-environment scheme payments (ANLb), and Cosun sugar beet area payments are significant income lines — often €200–€500/ha in total. xFarm provides no structured way to track subsidy applications, payment schedules, compliance requirements, or income realisation.

**No invoice management.** A 300-hectare Dutch arable farm receives 200–400 supplier invoices per year. xFarm cannot import, parse, or reconcile any of them.

**No cash flow visibility.** "In March I owe €38,000 in seed invoices. My Cosun advance arrives in April. The gap is 6 weeks and I need an overdraft." This is a predictable, recurring problem for every arable farmer. Predictable problems that software ignores are product failures.

### What FarmOS Does Better
PSD2 bank sync with Rabobank, ABN AMRO, ING — all Dutch agricultural bank transactions imported automatically and categorised. Invoice OCR from supplier PDFs (Agrifirm, De Groot, BAM). Per-field cost allocation derived automatically from logged activities — spray hours → sprayer cost per hectare → field cost without manual coding. Cash flow calendar: 13-week rolling forward view of expected payments and receipts. CAP subsidy payment tracker by crop and eco-scheme. Annual per-field P&L generated automatically.

---

## 8. Reports (Rapporten)

### What It Is
A reporting module generating downloadable PDF and Excel exports of: spray diary (compliant with EU/national formats), fertiliser records, harvest records, financial summary, field history.

### Why It Exists
Compliance. The spray diary report must be available for inspection by the NVWA (Netherlands Food and Consumer Product Safety Authority) for 3 years (spray diary) and 7 years (general records). Reports are also used for accountants, agronomists, and bank managers.

### How Often a Farmer Uses It
Once or twice per year: at the end of the spray season to verify the diary is complete, and when the regulatory inspector comes. Very occasionally for the accountant.

### Weaknesses

**The report is only as good as the data entered.** If a farmer logged a spray activity without the mandatory Dutch fields (certificate number, nozzle type, water volume), the compliance report is incomplete. xFarm does not validate completeness before report generation. A farmer who submits an incomplete report to the NVWA inspector has a compliance problem.

**No direct RVO submission.** The Dutch RVO portal accepts electronic spray diary submissions. xFarm generates a PDF. The farmer must download the PDF, log into the RVO portal, and manually upload. Two extra steps. One extra login. One more thing to forget. In an era where tax authorities across Europe accept API submissions directly from software, a PDF download is a design decision from 2012.

**Report templates are not country-specific enough.** The Dutch spray diary (spuitregistratie) has specific mandatory fields defined by the Wet gewasbeschermingsmiddelen en biociden. The German Pflanzenschutz-Kontrollbuch has different mandatory fields. xFarm generates one report template for both markets. It satisfies neither completely.

**7-year field history export is buried.** Dutch law requires field history records for 7 years. To export these from xFarm requires navigating to Reports → Field History → select field → select date range → export. Four steps for something a farmer only does when an inspector is standing in the doorway.

### What FarmOS Does Better
Compliance completeness check before report generation: "Your spray diary for 2025 has 3 incomplete entries (certificate number missing). Fix before export?" Direct RVO API submission for Dutch spray diaries. Country-specific report templates validated against the current legal requirements. One-tap 7-year field history export per field from the field detail screen.

---

## 9. Settings (Instellingen)

### What It Is
Account configuration: farm profile, user management, subscription plan, notification preferences, integration settings (weather station, machinery), language and units.

### Why It Exists
Administrative necessity. Every SaaS product has settings.

### How Often a Farmer Uses It
Once during onboarding, then almost never. Occasionally to add a new user or change notification preferences.

### Weaknesses

**Notification settings are all-or-nothing.** Either receive all notifications or none. There is no granularity: "I want frost alerts but not marketing messages. I want spray window alerts but not weekly summaries." This binary choice leads most farmers to turn off all notifications because the noise-to-signal ratio is too high. Then they miss the alerts that matter.

**Integration setup requires technical knowledge.** Connecting a Davis weather station, importing a GeoJSON shapefile, or configuring a JD Operations Center token requires steps that assume familiarity with API concepts. A 55-year-old Dutch farmer who did not grow up with computers will fail at this and either give up or call support.

**Subscription and billing are opaque.** What exactly is included in the current plan? What would I get if I upgraded? How many more users can I add? xFarm's settings page does not answer these clearly. Farmers discover plan limits by hitting them, not by understanding them in advance.

### What FarmOS Does Better
Granular notification control: each alert type (spray window, frost, disease pressure, stock low, compliance incomplete) is individually toggleable with a clear description of what triggers it and how often it fires on a typical farm. Integration setup uses guided flows — "Connect your Rabobank account: step 1 of 3" — not raw configuration fields. Plan usage shown clearly with a progress indicator: "7 of 10 fields used. Upgrade to add unlimited fields."

---

## 10. Users & Team (Team)

### What It Is
Multi-user management. Add employees, contractors, and agronomists with role-based access. Each user can log activities independently. Permissions control what each user can view and edit.

### Why It Exists
Most farms of meaningful size have employees or contractors. The farm owner needs oversight without giving full administrative access to a seasonal worker.

### How Often a Farmer Uses It
Rarely after initial setup. Occasionally when adding a seasonal worker at the start of campaign.

### Weaknesses

**Permission model is too simple.** Three roles: Admin, Manager, Operator. Real Dutch arable farms need: farm owner (full access + billing), permanent employee (log activities + view all), seasonal worker (log assigned activities only + cannot view financial data), external agronomist (view field data + add recommendations + cannot log activities), accountant (view financial data only). Five distinct roles. xFarm provides three.

**No GPS work confirmation.** When a seasonal worker logs that they sprayed field 12, there is no way to verify they were actually on field 12. GPS track logging would confirm the work and auto-calculate the area sprayed from the track. xFarm does not offer this.

**No time tracking.** Labour cost is a significant farm cost. xFarm does not track operator hours, cannot calculate labour cost per field or operation, and cannot integrate with payroll systems. The activity log has an operator name field but no start/end time.

**No contractor management.** Dutch farmers frequently use external contractors for: ploughing, planting, spraying, harvesting. These contractors need to log activities in the farm's system. xFarm's user model assumes everyone is a permanent farm employee. There is no "external contractor" role with appropriate access and data isolation.

### What FarmOS Does Better
Five-role permission model matching real farm structures. GPS track confirmation for field work — map view shows where the operator actually was. Time tracking per activity — start/end time captures labour hours automatically. Contractor access: external users log activities with read-only field visibility; their identity and licence number are captured for compliance records.

---

## Summary: Click Depth to Common Tasks

| Task | xFarm taps | FarmOS target |
|---|---|---|
| Log a spray activity | 7–9 | 2 (GPS + voice) / 3 (tap) |
| Check remaining stock for one product | 4–5 | 1 (search) |
| Find a specific field | 3–4 | 1 (GPS auto-select or search) |
| See spray window quality for today | 3 | 0 (morning push notification) |
| Export spray diary for current year | 4 | 2 |
| Add a seasonal worker | 5 | 3 |
| Check per-field cost to date | Not possible | 1 |
| Log weather at time of spray | Manual lookup + type | Automatic |

---

## The Structural Problem

Every screen in xFarm was designed to store data. Not one screen was designed to **answer a question**. The implicit assumption throughout the product is: if we give the farmer enough data, they will make good decisions. This assumption is false.

Farmers do not lack data. They lack interpretation, prioritisation, and decision support at the moment a decision must be made. The fields screen tells you what fields exist — it does not tell you which field is most at risk this week. The weather screen tells you the temperature — it does not tell you whether to spray. The inventory screen tells you what you have — it does not tell you whether you have enough for your plan.

FarmOS must be built around questions, not around data categories. Every screen should exist to answer a specific, time-sensitive farming question. If a screen does not answer a specific question, it should not exist.

---

*Next document: [03-dashboard.md](03-dashboard.md)*
