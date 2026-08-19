# xFarm — Weather, Satellite, AI & Intelligence Deep Audit
**Audit series:** FarmOS Competitive Intelligence  
**Document:** 05 — Weather, Satellite, NDVI, Disease, AI, Alerts  
**Date:** 2026-07-07  
**Classification:** Internal / Confidential

---

## Verdict Up Front

xFarm's "Intelligence" tier is the most expensive and least honest part of the product. Every feature marketed as AI is either a rule engine, a licensed third-party dataset, a data visualisation layer, or marketing copy attached to a decision tree. There is no trained machine learning model in production that meaningfully improves a Dutch farmer's decision-making.

This is not incompetence. It is a strategic positioning decision. Calling a threshold alert "AI" is cheaper to build and easier to market than actually building AI. The problem is that farmers are becoming literate enough to notice. Every farmer who discovers that the "AI spray advisor" is a lookup table becomes a sceptic of every feature claim xFarm makes thereafter.

This document dissects every intelligent feature, tells the truth about what it is, then describes what FarmOS builds instead.

---

## Part 1: Weather

### 1.1 What xFarm Offers

**Data sources:** Integration with one or more of: ECMWF (European Centre for Medium-Range Weather Forecasts), MeteoGroup/DTN, or Meteoblue. The specific provider varies by country and is not disclosed to users.

**What is shown:**
- Current conditions: temperature, humidity, wind speed and direction, precipitation, UV index, visibility
- Hourly forecast: 24 hours
- Daily forecast: 7–10 days
- Historical: some tiers allow past-day lookup

**Agricultural interpretation layer (Intelligence tier):**
- Spray suitability indicator: green / amber / red
- Frost risk alert
- Disease risk indicator (high-level, crop-agnostic in most cases)
- Evapotranspiration estimate (ET₀)

### 1.2 What Is Missing

**Soil temperature.** Not shown anywhere in the product. This is the most significant weather omission for arable farming.

Soil temperature governs:
- Pre-emergence herbicide activation (metazachloor, pendimethalin: minimum 5–8°C soil)
- Spring nitrogen timing (mineralisation begins above 5°C)
- Seed germination rate and uniformity
- Slug and pest activity onset
- Soil workability threshold

The KNMI publishes soil temperature readings at 5cm, 10cm, and 20cm depth for 34 stations across the Netherlands. This data is free, current, and available via API. xFarm does not use it.

**Dew point.** The dew point temperature determines:
- Condensation on leaf surfaces (infection period for Botrytis, downy mildew, Cercospora)
- Minimum safe spray temperature (avoid application within 3°C of dew point for most fungicides)
- Overnight wet period duration (critical for late blight infection models)

xFarm shows relative humidity. It does not calculate or display dew point. A farmer who needs dew point opens a weather station app or does the calculation manually.

**Leaf wetness.** Commercial weather stations measure leaf wetness duration as a key input into disease infection models. KNMI and private weather station networks provide this. xFarm does not surface it.

**Growing degree days (GDD).** Thermal time accumulation is the foundation of BBCH growth stage estimation, pest emergence forecasting (aphid flight, frit fly, carrot fly), and harvest forecasting for potatoes. GDD requires only daily maximum and minimum temperature and a base temperature. xFarm has all this data and calculates nothing with it.

**Wind at field level, not farm level.** A single weather point represents the entire farm. In Zeeland, field exposure to sea wind varies dramatically across a 3 km distance depending on tree belts, dykes, and topography. A spray decision made on one wind speed reading may be wrong for a field 2 km away.

**Precipitation since last application.** The most common question after rain: "Did enough rain fall to require a repeat application of my pre-emergence herbicide?" xFarm shows current and forecast precipitation. It does not calculate cumulative precipitation since the last relevant application or compare it to the product's rain-fast interval.

### 1.3 The Spray Suitability Score — What It Is

xFarm shows a coloured indicator: green = suitable, amber = marginal, red = unsuitable.

The criteria behind this indicator are not disclosed. Based on observed behaviour, the likely logic is:
- Wind > threshold (probably 5 m/s): red
- Precipitation probability > threshold (probably 40%): red
- Temperature < threshold (probably 5°C): red
- Otherwise: green or amber

**What this misses entirely:**

1. **Product-specific limits.** The legal spray wind limit in the Netherlands is **product-specific**: most products are restricted to ≤5 m/s near watercourses, but some require ≤3 m/s regardless of location. A generic wind threshold is wrong for every specific product.

2. **Nozzle-specific drift reduction.** Drift-reducing nozzles (90% reduction classification) allow application at higher wind speeds than standard flat fan nozzles under Dutch law. The spray suitability score ignores nozzle type.

3. **Field-specific watercourse proximity.** Buffer zone requirements affect the legal wind speed limit. A field bordering a drainage ditch has different requirements than a field in the middle of a polder. The score is the same for both.

4. **Re-entry interval from previous applications.** If the field was sprayed 18 hours ago and the product label requires a 24-hour re-entry interval before the next person can enter, the field is legally inaccessible even if the weather is perfect. Not checked.

5. **Pre-harvest interval.** If harvest is planned for next week and the product being applied has a 21-day PHI (pre-harvest interval), today may be the last legal spray date. Or it may be too late. The spray suitability score has no knowledge of planned harvest dates.

### 1.4 What FarmOS Builds

**Spray Window Scorer** — composite score 0–100, broken into 30-minute intervals for the next 48 hours.

Score components:
- Wind speed vs. product label maximum (weighted 35%)
- Temperature vs. product label minimum and maximum (weighted 20%)
- Dew point risk (within 3°C = evaporation and drift risk) (weighted 15%)
- Precipitation probability and timing relative to rain-fast interval (weighted 20%)
- Humidity (very high humidity = disease spread risk post-application, low humidity = rapid evaporation) (weighted 10%)

Product and nozzle type selected from the planned spray program — not generic thresholds. Field proximity to watercourse retrieved from the field map. PHI check against logged planting or planned harvest date.

Output: "Best window today: 09:30–12:00 (score 87). Window closes at 12:00 when wind picks up. If you delay until tomorrow, next window is Thursday 07:00–10:30 (score 79). Based on T2 wheat fungicide timing, Thursday is still within the efficacy window."

The farmer does not receive weather data. They receive a decision with the data behind it one tap away.

---

## Part 2: Satellite Imagery

### 2.1 What xFarm Offers

**Source:** ESA Sentinel-2 optical satellite imagery. Revisit time: 5 days at full resolution (10m bands), reduced to 2–3 days with paired Sentinel-2A/B. Cloud-free imagery required for optical data.

**What is shown:**
- True colour (RGB composite)
- NDVI (Normalized Difference Vegetation Index)
- In some tiers: LAI (Leaf Area Index), NDRE (Red Edge NDVI), NDWI (water index)

**Time series:** Historical comparison available in paid tiers.

### 2.2 The Netherlands Problem

The Netherlands receives an average of 1,600–1,800 hours of sunshine per year, compared to 2,200 in southern France and 2,800 in Spain. In the growing season (April–October), cloud cover days in the Netherlands average 60–70% of total days.

Sentinel-2 optical imagery is cloud-contaminated or unavailable for 60–70% of the Dutch growing season.

xFarm shows the satellite imagery widget regardless of image age. A 14-day-old image is presented with the same prominence as a 2-day-old image. A small "last updated: 14 days ago" label appears. Most farmers do not notice it. The information they are making decisions from may be two weeks out of date, describing a crop at a previous growth stage, during a previous weather period.

For the Netherlands market specifically, Sentinel-2 optical imagery is a marketing feature, not an operational tool. It provides useful data for perhaps 12–18 days per month in summer and fewer in spring and autumn.

### 2.3 What xFarm Does Not Offer: SAR

Sentinel-1 SAR (Synthetic Aperture Radar) imagery operates regardless of cloud cover. It penetrates cloud, fog, and rain. It provides different data: crop structure, biomass estimation, soil moisture, and flood detection.

SAR is processed differently from optical imagery and is more complex to interpret. But for the Netherlands specifically:
- It is available every 6 days regardless of weather
- It provides soil moisture data critical for workability assessment
- It detects crop lodging after storm events
- It identifies waterlogged field sections before visual symptoms appear

No major farm management platform offers integrated SAR analysis for smallholder/mid-size farms. This is a first-mover opportunity. The Sentinel-1 data is free. The processing is available via Google Earth Engine or Copernicus Data Space. The interpretive layer requires building. The competitive advantage is significant in cloudy-climate markets.

### 2.4 What xFarm's NDVI Analysis Actually Does

NDVI = (NIR − Red) / (NIR + Red)

This is a reflectance ratio. It correlates with green biomass. It is calculated pixel by pixel from raw Sentinel-2 spectral band data. There is no machine learning involved. It is a physical measurement of light reflection.

xFarm applies a colour gradient to the NDVI raster and overlays it on the field map. That is the extent of the "analysis."

**What is missing:**

- **Anomaly detection relative to historical baseline.** If zone C of field 12 normally reads NDVI 0.75 at this date and this year reads 0.58, that is an 18% decline. That is meaningful. xFarm shows the current value but not the deviation from expected.
- **In-field zone delineation.** Clustering the NDVI raster into management zones (high / medium / low biomass areas) for variable rate application guidance.
- **Change detection between images.** Comparing consecutive cloud-free images to detect: rapid decline (disease, pest, drought stress), rapid increase (weed outbreak outpacing crop), or unusual patterns (drainage failures creating low-NDVI strips).
- **Correlation with yield maps.** If the same zone consistently shows low NDVI and also consistently produces low yield (from combine data), that zone requires investigation. xFarm cannot make this connection.

### 2.5 What FarmOS Builds

**Satellite intelligence, not satellite data.**

The satellite module activates only when there is something actionable to show:

1. **New cloud-free image available:** surfaced with automatic change detection vs. previous image and vs. same-date-last-year. Shows: "Keetje Noord — Zone B shows 14% NDVI decline vs. last image (8 days ago). No change expected from crop stage. Recommend: scout Zone B this week."

2. **SAR soil moisture update:** available every 6 days regardless of cloud. Shows: "Field 7 (heavy clay) currently at 89% field capacity. Not trafficable. Expected trafficable again: 4 days if no further rain."

3. **Zone delineation map:** on demand from the field detail screen. Clusters the field into 3–5 management zones based on historical NDVI variability. These zones can be used as the basis for variable rate application maps or targeted scouting.

The satellite imagery is not shown as a pretty picture. It is shown as an alert or a recommendation when it contains information that changes what the farmer should do today.

---

## Part 3: Disease Models

### 3.1 What xFarm Offers

xFarm claims "smart pest and disease alerts." The reality:

**Source of alerts:** A combination of (a) licensed content from third-party advisory services (Dacom in the Netherlands, DLG in Germany, Arvalis in France) and (b) simple rule-based thresholds applied to weather data.

**What "disease risk" means in xFarm:** If regional temperature and humidity exceed a threshold in a specific crop calendar period, xFarm flags "disease risk: HIGH." This threshold is not field-specific. It is not crop-growth-stage-specific in most cases. It is not integrated with the farmer's specific spray history (did they apply a fungicide last week? Was it effective against this pathogen?).

**The Dacom example (Netherlands):** Dacom provides the PhytoPRE model for late blight in potatoes — one of the best-validated disease infection models in European agriculture. It uses hourly temperature, humidity, and leaf wetness duration to calculate infection units per day. It is integrated into xFarm as a data feed. xFarm shows the risk level Dacom calculates. This is not xFarm's AI. This is a licensed display of someone else's model.

Dutch farmers who know about Dacom go directly to dacom.nl and get the same information faster and with more detail. xFarm's integration adds one step in the middle without adding value.

### 3.2 Disease Models That Do Not Exist in xFarm

**Septoria tritici blotch in wheat.** The most economically important disease in Dutch and UK wheat. Infection models exist in the scientific literature: temperature + leaf wetness + growth stage + varietal susceptibility → infection probability. No implementation in xFarm.

**Cercospora leaf spot in sugar beet.** The primary fungal disease in Dutch sugar beet. IRS (Instituut voor Rationele Suikerprodukties) maintains a cercospora advisory service. Not integrated in xFarm for Dutch users.

**Sclerotinia in oilseed rape.** Weather-driven during flowering. Models exist. Not in xFarm.

**Wireworm (Agriotes) emergence model.** Dutch potato and sugar beet farmers lose significant yield to wireworm. Soil temperature-driven emergence models predict risk periods. Not in xFarm.

**Aphid flight model for beet yellows and PLRV.** Aphid population models driven by temperature accumulation and trap catches predict early flight dates that determine insecticide timing. DLO and SYNGENTA maintain these models. Not in xFarm.

### 3.3 What FarmOS Builds

**Crop-specific, field-specific disease intelligence.**

For each crop on each field, FarmOS runs the relevant disease models continuously:

**Wheat (Septoria):** Modified Fry model — cumulative infection units from hourly temperature and leaf wetness. Reset after effective fungicide application (checking the product's known efficacy against the pathogen). When infection units exceed the economic threshold for the current BBCH stage: "Septoria infection risk HIGH on your 4 wheat fields. T2 fungicide window aligns with your spray window Thursday. Recommended: [product from your inventory with CTB approval for this crop]."

**Potato (Late blight):** Dacom PhytoPRE model integrated, but enhanced: FarmOS uses the farmer's actual variety's resistance score (from the potato variety database) to modulate the threshold. A farmer growing Innovator (high resistance) gets a different alert threshold than a farmer growing Bintje (very susceptible).

**Sugar beet (Cercospora):** IRS cercospora model + farm-specific leaf wetness from nearest KNMI station. Alert includes: current disease score, recommended spray interval based on product label, and check against maximum number of applications per season.

**Integration principle:** FarmOS does not show disease risk. It shows: current status, what it means for **this crop on this field**, and what action is recommended with what urgency.

---

## Part 4: AI — The Honest Audit

### What xFarm Calls AI

| Feature name | What it actually is | Category |
|---|---|---|
| AI Crop Advisor | Decision tree: crop × growth stage × pest/disease → lookup table of registered products | Rule engine |
| Smart Alerts | Licensed third-party models (Dacom, DLG, Arvalis) surfaced via API | Data resale |
| Spray Suitability | Three weather threshold checks (wind, temp, rain probability) | Rule engine |
| Yield Prediction | Linear regression on manually-entered yield history, if enough data exists | Weak statistics |
| Field Intelligence (NDVI) | Physics-based spectral index calculation | Data processing |
| xFarm Intelligence tier | Marketing label applied to the same features with higher pricing | Marketing |
| Satellite Analysis | Copernicus data download + colour gradient application | Visualisation |
| Weather Intelligence | ECMWF/DTN data repackaged with threshold flags | Data integration |

**Confirmed ML in production at xFarm: zero.**

This is not a criticism of their engineering team. Building and validating agronomic ML models is genuinely hard. The criticism is of the marketing positioning that calls all of the above "AI" without disclosure.

### The Conflict of Interest in Recommendations

When xFarm's "AI Crop Advisor" recommends a specific fungicide product, three possible reasons exist:

1. It is agronomically the best product for this crop, pest, and growth stage
2. It is the product in the farmer's inventory
3. The product manufacturer paid for preferred placement in xFarm's recommendation engine

xFarm does not disclose which of these applies to any given recommendation. The recommendation is presented as neutral agronomic advice. If reason 3 applies to any recommendation in the system, the entire system is compromised and farmers cannot trust any of it.

This creates a regulatory risk for xFarm: the EU's proposed AI Liability Directive and the existing Unfair Commercial Practices Directive both have provisions that could apply to undisclosed sponsored recommendations presented as neutral advice.

### What Real AI Looks Like in This Domain

FarmOS uses language models and ML in three specific, honest ways:

**1. Natural Language Activity Logging**

Input: "I sprayed Retengo Plus at 1.5 litres per hectare on the Westpolder beet fields this morning, temperature was 17 degrees, wind from the north at about 3"

LLM extraction: product=Retengo Plus, dose=1.5 L/ha, fields=[Westpolder beet fields → resolved to field IDs 12, 13, 15 from field registry], date=today, time=morning, temperature=17°C, wind direction=N, wind speed=3 m/s

Pre-filled form shown for farmer confirmation. Confidence indicators on extracted values. Farmer taps Save. Total time: 20 seconds.

This is real LLM usage. It reduces cognitive load and entry time. It works on ambiguous natural language ("the beet fields" → resolved from the farm's field registry). It is genuinely intelligent.

**2. Computer Vision Disease Identification**

Input: photograph from the farmer's phone of a diseased leaf

Processing: Multimodal vision model (fine-tuned on agricultural disease image datasets) identifies: probable disease/pest, confidence score, stage of infection, and similar cases from the training set.

Output: "This appears to be early-stage Septoria tritici blotch (confidence: 82%). Infection is limited to lower leaves. At this stage and in current weather conditions, you have 5–7 days before economic threshold is likely reached. Recommended: scout the rest of the field for spread. Do you want to schedule a scouting activity?"

Limitations disclosed. Farmer is always the decision-maker. The AI is a first-pass assessment, not a prescription.

**3. Predictive Spray Window Optimisation**

Input: planned spray activities for the next 7 days, product labels, field locations, weather forecast, operator availability

ML model output: optimal spray schedule — which fields in which order on which days maximise efficacy (best weather conditions relative to disease pressure) and minimise compliance risk (no expired PHI, no prohibited dates)

Output shown as: ranked recommendation list for each day, with confidence score and key constraint identified for each decision.

This is a multi-variable optimisation problem. It is not a rule engine. It requires a trained model. It delivers a output that cannot be calculated by a lookup table.

---

## Part 5: Alerts

### What xFarm Sends

Based on user reports across G2, Capterra, and App Store reviews, xFarm sends approximately:
- 1–2 weather alerts per day (often low-value: "rain expected tomorrow")
- 1–2 system/product notifications per week
- 1–4 partner/sponsored messages per week
- 1 activity reminder if activities haven't been logged for X days

**Total push notifications per week: 8–15**  
**Fraction that are actionable for the farmer: 15–25%**

The result: most farmers disable all notifications within 30 days. Then they miss the alerts that actually matter.

### The Notifications Problem Is a Trust Problem

Every non-actionable notification is a withdrawal from the farmer's attention bank. Once the balance goes to zero, all notifications are ignored regardless of content. xFarm has spent the notification budget on system messages and partner promotions. When the frost alert comes, the farmer doesn't see it.

### What FarmOS Sends

**Maximum 3 push notifications per day.** Hard limit. System-enforced.

**Required to send:** Each notification must pass two tests before it is sent:

1. **Actionability:** Can the farmer do something about this in the next 6 hours that meaningfully affects their farm?
2. **Uniqueness:** Is this information the farmer does not already have from another source (e.g., they looked at the weather themselves)?

**Notification types and timing:**

| Alert type | Trigger | Delivery time | Financial context |
|---|---|---|---|
| Spray window tomorrow | Composite score > 70 for first time in >48 hours | 20:30 tonight | "4 wheat fields ready, estimated cost €1,400" |
| Disease threshold crossed | Model crosses economic threshold | As detected, max 07:00 | "Untreated: ~€180/ha yield loss" |
| Stock below reorder point | Inventory level < planned activity need | 07:00 the day before needed | "Order today for Thursday delivery" |
| Frost risk overnight | Temperature forecast < 2°C near ground level | 20:00 | "Young beet crop most at risk" |
| Spuitlicentie expiry | 60, 30, 14 days before expiry | 07:00 | Regulatory consequence explained |
| Compliance gap | Spray diary has incomplete mandatory field | 09:00 Monday | "3 entries missing certificate number" |

**Partner communications:** opt-in only, clearly labelled, delivered in a dedicated commercial messages section separate from operational alerts. Never mixed with agronomic alerts.

---

## What FarmOS Does That No Competitor Does

**Spray efficacy learning loop.** FarmOS tracks: spray applied → disease model reading before application → disease model reading 7 days after application → NDVI change (if satellite available). Over multiple seasons, this builds a per-farm, per-product efficacy dataset. "In your conditions, Retengo Plus applied at BBCH 39–41 on your sandy clay soils consistently outperforms Proline by an average of 8% in Septoria suppression based on your last 3 seasons." This is the kind of insight that a 30-year agronomist develops from field observation. FarmOS makes it available to every farmer after 2 seasons of data.

**Pre-season spray programme optimisation.** Before the season starts, FarmOS generates a crop-specific spray programme recommendation for each field based on: previous crop disease history, field soil type, regional disease pressure history, varietal susceptibility, and budget constraint. The programme is a starting point, not a mandate. Farmers modify it. As the season progresses, the programme updates in real time as actual disease pressure and weather deviate from forecast.

**Weather station integration.** For farmers with on-farm Davis or Lufft weather stations, FarmOS ingests local weather at 10-minute resolution. Local data replaces KNMI station data for all calculations. Field-specific spray windows become dramatically more accurate. If a farmer does not have their own station, FarmOS uses the nearest quality-controlled KNMI station with distance and elevation correction.

---

*Next document: [06-inventory-finance.md](06-inventory-finance.md)*
