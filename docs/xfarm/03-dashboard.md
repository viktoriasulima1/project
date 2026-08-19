# xFarm — Dashboard Deep Audit
**Audit series:** FarmOS Competitive Intelligence  
**Document:** 03 — Dashboard, Widgets, KPIs, Interactions  
**Date:** 2026-07-07  
**Classification:** Internal / Confidential

---

## Verdict Up Front

The xFarm dashboard is a trophy case. It displays everything the company is proud of having built. It was not designed around what a farmer needs to see at 06:15 before getting in the tractor. It is a demo screen — impressive in a sales pitch, nearly useless in a polder in November.

The fundamental design error: **every widget reports the past**. A farm is a living operation moving forward in time. The dashboard should answer "what do I do today?" It answers "here is what exists on your farm." These are not the same question.

Counted across all tier levels and crop configurations, xFarm's dashboard has between 7 and 11 active widgets depending on what the user has enabled. Each is audited below.

---

## Widget 1: Farm Map

### What It Shows
A satellite or terrain basemap with coloured polygon overlays for every registered field. Fields are colour-coded by current crop type. Clicking a field opens its detail card.

### Why It Exists
Visual orientation. Proving to the farmer that the software knows their farm. Generating the screenshot used in every cooperative pitch deck.

### How Often It's Useful
Every session as a navigation anchor. Never as a source of decision-relevant information.

### What the Data Actually Tells a Farmer
Nothing actionable. The fields are there. The crops are there. Both facts were true yesterday and will be true tomorrow.

### Hidden Assumptions That Are Wrong
- That all fields are equally important today
- That the map is current (satellite imagery may be 5–14 days old due to cloud cover)
- That the farmer needs visual confirmation their fields exist

### Weaknesses

**No urgency layer.** The map shows where fields are. It does not show which fields need attention. A fungicide-critical wheat field at BBCH 39 and a fallow field look identical on this map. There is no risk overlay, no growth stage heat map, no "3 fields in your spray window today" indicator.

**No NDVI embedded in the map widget.** The NDVI data exists in a separate widget and a separate screen. A field showing stress should change colour on the main map. It does not.

**Interactivity is shallow.** Tapping a field opens a detail card with: crop name, area, last activity date. It does not surface: current risk level, nitrogen applied vs. limit, next scheduled task, or days since last inspection. The tap reveals the answer to questions nobody is asking.

**Colour coding is crop-based, not status-based.** Green = wheat, yellow = potato, orange = sugar beet. This is inventory thinking applied to a map. A farmer who knows what they planted does not need a legend to identify their own fields. What they need is a status signal: which field is at risk, which field is on track, which field is behind.

**No zoom memory.** Every session opens the map at full-farm extent. A farmer who manages 60 fields across two regions zooms in to the northern cluster every morning. xFarm resets the zoom every time.

### What FarmOS Does

The FarmOS map is a **decision surface**. Fields are coloured by current operational status, not crop type. Three states:

- **Amber:** action required this week (BBCH trigger reached, spray window coming, scheduled task overdue)
- **Red:** action overdue or risk detected (compliance window closing, disease pressure alert, stock insufficient for planned spray)
- **Grey:** no action required, on track

Tapping a field opens: current BBCH, next recommended action with estimated window, nitrogen applied vs. limit (bar chart, 5 seconds to read), last activity. The map is the answer to "where do I need to go first today?" not a static diagram of where things are.

---

## Widget 2: Weather Strip

### What It Shows
Current temperature, wind speed and direction, precipitation probability, and a 24-hour hourly forecast strip. In paid tiers: a 7-day daily summary.

### Why It Exists
Farmers check weather constantly. Putting weather on the dashboard keeps users in the app rather than switching to Buienradar or Weeronline.

### Weaknesses

**It shows conditions. It does not answer the question.** The weather strip displays: 13°C, wind NW 7 m/s, precipitation 15%. A farmer needs to know: "Can I spray Proline on my wheat fields this morning?" The answer requires cross-referencing wind speed against the product label maximum (typically 5 m/s for most fungicides near watercourses), temperature against the product minimum, humidity against evaporation risk, and precipitation timing against the pre-rain interval (usually 1–4 hours depending on product). xFarm shows the inputs. It never calculates the answer.

**No soil temperature.** Pre-emergence herbicides require soil above a minimum temperature for activation. Soil cultivation decisions depend on soil moisture and temperature. Soil temperature is not shown anywhere on the xFarm dashboard. It is not shown anywhere in the product.

**No growing degree day counter.** BBCH stage estimation from thermal time accumulation is first-year agronomy. Knowing that today's temperature accumulation brings the wheat to BBCH 37 changes what spray activities are scheduled for this week. xFarm shows air temperature. It never accumulates it into anything useful.

**No dew point.** Dew point determines condensation risk for fungal disease, minimum spray temperature threshold, and overnight wet period duration. Not shown.

**Location is wrong for large farms.** Weather is pulled for one GPS point per farm. A Dutch farm spanning 250 ha across two water board zones may have 2–3°C temperature difference, different wind exposure, and different precipitation timing across its extent. One weather reading misrepresents reality for any farm larger than a single field.

**The "agricultural interpretation" in paid tiers is cosmetic.** xFarm Intelligence adds coloured icons for frost risk, disease risk, and spray suitability. These are binary flags based on simple thresholds — wind above X m/s = not suitable. They do not account for: which product you plan to use (each product has its own label restrictions), your proximity to watercourses (affects legal wind speed limits), your nozzle type (drift-reducing nozzles allow higher wind speeds), or your local crop growth stage (disease risk thresholds vary by BBCH). A spray suitability score that ignores the product being applied is not a spray suitability score.

### What FarmOS Does

The weather widget is replaced by a **Spray Window Scorer** as the primary UI element:

```
TODAY — SPRAY WINDOW QUALITY
06:00–09:00  ██░░░░░░  31  Too windy (7 m/s)
09:00–12:00  ████████  84  GOOD  → 4 wheat fields ready
12:00–15:00  ██████░░  67  Acceptable → check label
15:00–18:00  ████░░░░  42  Rain arriving 16:30
```

Score is composite: wind speed vs. product label max, temperature vs. label min, dew point risk, precipitation forecast, re-entry interval from previous application. Each field's planned product is factored in — the score changes if you're applying a watercourse-sensitive product vs. a standard one. The raw weather data (temperature, wind, humidity, precipitation) is one tap deeper for farmers who want it.

---

## Widget 3: Recent Activities

### What It Shows
A chronological list of the last 5–10 farm operations logged: spray events, fertiliser applications, sowing, tillage. Each entry shows field name, activity type, date, and operator.

### Why It Exists
Quick reference to verify yesterday's work was logged. Also serves as a navigation shortcut to the full activities log.

### Weaknesses

**It looks backward.** Recent activities tell the farmer what happened. The farmer already knows what happened — they did it. What they need is what happens next.

**No anomaly detection.** If a spray activity was logged at a dose 40% above the label recommendation, the recent activities widget shows it without comment. An automated check (dose logged vs. label maximum; area sprayed vs. field area; weather conditions at time of application vs. label requirements) would catch errors before they become compliance failures. xFarm never checks.

**No completion status.** If a planned spray program for a field was scheduled across 3 passes and only 2 have been logged, recent activities does not surface the missing pass. There is no concept of planned vs. actual.

**No cost accumulation.** Each activity has a cost (product used × price per litre + machine time + labour). Recent activities shows what was done but never what it cost.

### What FarmOS Does

The activity widget is replaced by **Today's Summary**:

- Activities logged today: 3
- Estimated cost today: €340
- Compliance flags: 0
- Missed scheduled tasks: 1 → [Tap to review]
- Stock alerts triggered: Proline below reorder threshold → [Order now]

The widget looks forward as much as backward. It confirms what was done and immediately surfaces what was missed or triggered.

---

## Widget 4: Active Crops / Crop Status

### What It Shows
A list or card view of active crop-field season combinations. Each card shows: crop name, field count, total area, planting date, and current growth stage (if manually entered).

### Why It Exists
To give an overview of what is being grown and to navigate into crop-specific activity planning.

### Weaknesses

**Growth stage is manually entered and therefore wrong.** Farmers enter growth stage once and forget to update it. The crop status widget shows "wheat at BBCH 30" when the crop has been at BBCH 37 for three weeks. An outdated growth stage cascades into wrong spray timing recommendations, wrong fertiliser application windows, and misleading compliance records.

**No financial performance per crop.** The crop card shows area and planting date. It does not show: cost to date per hectare, cost vs. budget, expected margin based on current input spend and forward price. This is the most important business information on the farm.

**No risk indicator per crop.** Which crop is most at risk this week from disease, pest, or weather? The crop status widget treats all crops equally. A potato crop at row closure in a wet week with cercospora pressure and a wheat crop at BBCH 22 in dry conditions are shown with identical visual treatment.

**Cross-crop comparison is impossible.** A farmer growing wheat, potato, and sugar beet simultaneously cannot compare their relative financial performance, input spend, or risk levels from this widget.

### What FarmOS Does

The crop card shows three numbers prominently, calculated automatically:

1. **Current BBCH** — derived from planting date + KNMI thermal time accumulation
2. **Cost/ha to date** — derived from logged activities + auto-costed inputs
3. **Risk level** — composite of disease pressure, upcoming weather risk, and missed spray window count

The farmer who looks at their wheat card sees: "BBCH 38 · €287/ha to date · Risk: MEDIUM (T2 fungicide window opens Thursday)." Three seconds to read, one tap to act.

---

## Widget 5: NDVI / Satellite Imagery Thumbnail

### What It Shows
A small satellite image thumbnail showing the most recent NDVI (Normalized Difference Vegetation Index) analysis for one or more fields. Colour gradient from red (low vegetation density) to dark green (high).

### Why It Exists
Satellite imagery is the most visually impressive feature in the product. It is the feature that makes farmers say "wow" in demos. It is the primary acquisition hook — the reason a farmer signs up for the free tier and shares the screenshot with their neighbour.

### Weaknesses

**The Netherlands is cloudy.** Sentinel-2 optical imagery requires cloud-free conditions. The Netherlands has reliable cloud cover for 60–70% of the growing season. The NDVI thumbnail on the xFarm dashboard frequently shows imagery that is 8–15 days old. An NDVI from 12 days ago during a wet spell in July tells a Dutch potato farmer nothing useful about today's crop condition.

**The widget is shown even when imagery is useless.** xFarm shows the NDVI widget regardless of image age or quality. A greyed-out "last image: 14 days ago" message appears in small text. Most farmers either do not notice or do not understand what this means for the image's relevance.

**NDVI without interpretation is noise.** A dark red patch on the NDVI image means something is wrong. But what? Stress from drought? Disease? Soil variability? Compaction? Waterlogging? The xFarm NDVI widget shows the result without any interpretation of cause. A farmer who sees a red zone on their field and taps it receives: "Low vegetation index. This zone may require attention." This is not useful.

**Sentinel-2 only.** There is no Sentinel-1 SAR (Synthetic Aperture Radar) integration. SAR penetrates cloud cover and provides crop structure and soil moisture data regardless of weather conditions. For the Netherlands market specifically, SAR is substantially more useful than optical imagery. xFarm has not built this.

**Resolution is too coarse for Dutch polders.** Sentinel-2 has a 10m resolution. Dutch fields are often narrow strips separated by drainage ditches 2–3m wide. At 10m resolution, the field boundary bleeds into the ditch and adjacent field, producing spurious NDVI values at every edge. For large fields in other markets this is acceptable. For narrow Dutch polder strips it is not.

### What FarmOS Does

The satellite widget only surfaces when it is **actionable**:

- Image is less than 5 days old: shown prominently
- Image is 5–10 days old: shown with age indicator
- Image is older than 10 days: widget is replaced by the next highest-priority item

When shown, anomaly detection runs automatically: "Zone C on Keetje Noord shows 18% lower NDVI than the same zone last year at this date. Possible causes: drainage issue, uneven establishment, or late disease infection. Scout this zone." The farmer gets a specific location, a comparison baseline, and a suggested action — not a colour gradient and a legend.

---

## Widget 6: Tasks

### What It Shows
A list of open tasks assigned to the farm or a specific operator. Tasks can be manually created with a due date, assignee, field, and description.

### Why It Exists
Basic task management for farm operations. Reminder system for planned activities.

### Weaknesses

**Tasks are manually created.** Nobody creates tasks systematically on a busy farm. The task widget is always empty because task creation requires forethought, time, and a second screen interaction that most farmers do not bother with during a working day.

**Tasks are not generated from agronomic data.** If the wheat crop reaches BBCH 39 tomorrow, a T2 fungicide application is agronomically due within 5–7 days. This task should be generated automatically and appear in the task widget. It is not. The farmer must know to create the task themselves — which defeats the purpose of having a crop management system.

**No priority ranking.** If a farmer has 12 open tasks, xFarm shows them in creation order. There is no urgency ranking. The frost protection task created this morning appears below the "order seed potatoes" task created three weeks ago.

**No financial consequence attached to tasks.** Missing a T2 spray on 80 ha of wheat costs approximately €1,600–2,400 in yield reduction (conservative estimate: 0.5–0.8t/ha yield loss × €220/t). xFarm does not attach financial consequence to delayed tasks. Farmers who do not quantify urgency procrastinate. Farmers who see "missing this task costs you €2,100" do not.

### What FarmOS Does

Tasks are generated from three sources:

1. **Agronomic triggers** — BBCH stage reached, disease model threshold crossed, scheduled spray interval elapsed
2. **Compliance triggers** — mandatory inspection due, spuitlicentie expiry within 60 days, 7-year record retention approaching
3. **Manual entry** — farmer-created tasks for logistics, equipment, and administration

Each task shows: due date, estimated time, financial consequence of delay (where calculable), and one-tap logging to convert the task into a completed activity. The task list is ranked by urgency × financial consequence. The most important thing appears first.

---

## Widget 7: Financial Summary

### What It Shows
Year-to-date income vs. expenses by category. A simple bar chart. Total balance (income minus expenses). Budget vs. actual percentage.

### Why It Exists
To justify calling xFarm a "farm management" system rather than a "spray diary with extras." The financial widget is visible proof that the product handles business management, not just compliance.

### Weaknesses

**The numbers are only as real as the manual entries.** No bank sync. No invoice import. No automatic cost derivation from activities. If the farmer has not manually entered every cost category this month, the chart is wrong. Most farmers haven't entered everything. The financial widget on most xFarm accounts shows a partial, misleading picture.

**Aggregated by category, never by field.** The chart shows "Crop Protection: €18,400 YTD." It does not show "Crop Protection per field" or "per hectare" or "per crop." The most valuable financial analysis — "which field is making or losing money?" — is impossible.

**No forward visibility.** The chart shows what has been spent. It shows nothing about upcoming costs (scheduled activities, invoice payment schedules, machinery service costs) or upcoming income (advance payments from Cosun or Aviko, CAP payment schedule, grain sale delivery dates).

**Income lines are unrealistically complete.** If the farmer has entered all their costs but only half their income (because cooperative payments arrive quarterly and the farmer entered them manually when received), the balance shows a false loss. The widget has no way to distinguish between "no income" and "income not entered yet."

### What FarmOS Does

The financial widget requires bank sync to be activated. Without it, a prompt is shown: "Connect your Rabobank account to see real financial data. Setup takes 2 minutes." With it, the widget shows:

- **Cash position today** (actual bank balance)
- **Biggest upcoming payment** with date (e.g., "Agrifirm invoice €6,200 due in 11 days")
- **Season margin forecast** — current spend trajectory vs. expected revenue, generating a per-hectare margin estimate for the season
- **Crop cost comparison** — input cost per hectare per crop, colour-coded against last year

The financial widget is either real or it is absent. It is never shown as real when it is not.

---

## Widget 8: Notifications / Alerts

### What It Shows
A feed of recent platform notifications: activity reminders, weather alerts, satellite imagery available, system announcements, promotional messages from xFarm partners.

### Why It Exists
Proactive communication of time-sensitive information. Also: a channel for partner communication (agrochemical companies paying for recommendation placement).

### Weaknesses

**Signal-to-noise ratio is catastrophic.** A typical xFarm notification feed contains: 1 genuinely useful alert (frost risk tonight), 2 system announcements ("new feature available in Intelligence tier"), 3 partner messages ("Syngenta webinar on Septoria management"), and 1 reminder to complete the farm profile. Farmers switch off all notifications after two weeks of this. Then they miss the frost alert.

**No financial impact attached to alerts.** A disease pressure alert says "Septoria risk HIGH in your region." It does not say "At current wheat prices, leaving this untreated costs approximately €160/ha if the infection develops. Your 4 wheat fields = €6,400 at risk." Quantifying consequences changes behaviour.

**Partner-sponsored alerts are indistinguishable from agronomic alerts.** When a Bayer agronomist recommendation appears in the same feed as a system frost alert with the same visual treatment, the farmer cannot distinguish paid product placement from genuine risk notification. This is a trust problem that will become a regulatory problem.

**Timing is wrong.** Alerts arrive when xFarm's system generates them, not when farmers are able to act. A spray window alert delivered at 14:00 for a window that opens at 06:00 tomorrow is less useful than one delivered at 21:00 tonight when the farmer is planning the next day.

### What FarmOS Does

Maximum 3 push notifications per day. Each notification:

1. Answers one specific question
2. Carries a financial impact estimate where calculable
3. Is delivered at the optimal decision time (spray window alerts at 21:00 for the next day; frost alerts at 20:00 when field protection actions are still possible)
4. Is never sponsored

Partner communications are a separate opt-in channel, visually distinct, clearly labelled as commercial content, and disabled by default.

---

## The Missing Widgets — What xFarm Doesn't Show

These widgets do not exist in xFarm. They should exist in FarmOS.

**Nitrogen Balance Bar.** For each Dutch farm, a running total of nitrogen applied vs. the legal limit per crop type. Coloured green → amber → red as the limit approaches. A Dutch arable farmer faces criminal liability for exceeding nitrogen limits. This should be the most prominent compliance indicator on the dashboard.

**Spray License Status.** Spuitlicentie (spray licence) expiry date with days remaining. Dutch law requires a valid licence to apply plant protection products. Expiry catches farms by surprise every 5 years. A countdown should be permanently visible.

**Stock Sufficiency Indicator.** "You have enough product for your next 3 planned spray operations. Stock for Operation 4 (T3 fungicide, week 28) is insufficient. Shortfall: 12L Proline." Planned activities × dose per hectare × field area = required stock. Current stock − required = sufficiency or shortfall. This is a simple calculation that xFarm never makes.

**Season Progress.** A timeline bar showing where the farm is in the agricultural calendar. Key milestones marked: T1 spray window (past), T2 window (current), T3 window (upcoming), harvest forecast, end of season. Financial milestones: seed invoice (paid), Cosun advance (expected), crop delivery payment (expected). One bar that shows where you are in the year, financially and agronomically.

---

## The FarmOS Dashboard Philosophy

The xFarm dashboard is organised around **modules** — Inventory, Weather, Fields, Activities. FarmOS is organised around **decisions** — What do I do today? Am I compliant? Is my business on track?

Every pixel on the FarmOS dashboard earns its place by answering a question that a farmer needs answered in the next 24 hours. If a widget cannot identify the question it answers, it does not appear.

The dashboard loads in under 1 second from local cache with background sync. It works identically offline and online. It renders usably on a 6-inch phone screen with dirty gloves and full sun glare. It requires zero reading to understand — every indicator uses form (colour + icon) not just text.

At 06:00, Jan Verhoeven opens FarmOS. In 8 seconds he knows:
- Spray window today: good, 09:30–13:00
- 3 wheat fields ready for T2 fungicide
- Proline stock: sufficient
- Nitrogen on field 12: 87% of limit used — caution next application
- One task overdue: beet scouting on Westpolder

He taps "Start today" and the app pre-loads the spray activity form for the first field. In xFarm, the same information requires opening 4 different screens, making 2 phone calls, and one trip to the office to check the nitrogen spreadsheet.

---

*Next document: [04-navigation.md](04-navigation.md)*
