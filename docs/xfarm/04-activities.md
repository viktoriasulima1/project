# xFarm — Activities Deep Audit
**Audit series:** FarmOS Competitive Intelligence  
**Document:** 04 — Activities, Logging, Workflow, Speed  
**Date:** 2026-07-07  
**Classification:** Internal / Confidential

---

## Verdict Up Front

The activity log is xFarm's only genuinely critical feature. It is the one screen farmers must use. It is the one screen that drives retention. It is the one screen that EU regulations enforce. And it is the worst-designed screen in the product.

Seven to nine taps to log a spray event. Manual weather entry. No voice. No smart defaults. No bulk logging. No offline guarantee. For a screen that a Dutch arable farmer uses 200–400 times per year, each of these failures compounds into hours of wasted time and dozens of compliance errors per season.

If FarmOS wins the activity logging experience, xFarm loses its only defensible moat.

---

## How Activity Logging Works in xFarm

The standard path to log a spray activity:

```
Dashboard
  → Activities (sidebar tap)
    → + New Activity (FAB or header button)
      → Select Activity Type (spray / fertilise / sow / harvest / tillage / other)
        → Select Field (dropdown or map picker)
          → Enter Date (date picker)
            → Enter Operator Name (free text)
              → Enter Area Sprayed (numeric input)
                → Select Product (dropdown from inventory)
                  → Enter Dose Per Hectare (numeric input)
                    → Select Dose Unit (L, kg, g dropdown)
                      → Enter Weather: Temperature (numeric)
                        → Enter Weather: Wind Speed (numeric)
                          → Enter Weather: Wind Direction (dropdown)
                            → [Dutch mandatory fields]:
                               Certificate Number (text)
                               Nozzle Type (dropdown)
                               Water Volume Per Ha (numeric)
                               Machine Used (dropdown)
                              → Save
```

**Minimum taps from a cold start: 14**  
**Minimum taps if already in Activities: 11**  
**Time per entry in the field (cab, gloves, 3G): 4–7 minutes**  
**Time per entry desktop, office conditions: 2–3 minutes**

A farmer spraying 6 fields in one day on a campaign where the same product, dose, and machine are used throughout: 6 × 5 minutes = 30 minutes of administrative work for one day's spraying. Across a 20-week spray season with 3 spray rounds per crop on 80 hectares, this compounds to 15–25 hours of data entry per year for compliance records alone.

xFarm is billing farmers for the privilege of doing their own compliance administration.

---

## Activity Type 1: Spraying (Spuiten)

### The Compliance Obligation

Dutch spray diary requirements under the Wet gewasbeschermingsmiddelen en biociden mandate the following per spray event:

1. Date
2. Crop and growth stage (BBCH)
3. Field identification (BRP parcel number)
4. Area treated (hectares)
5. Product name and registration number (CTB-nummer)
6. Applied dose per hectare
7. Total quantity applied
8. Weather conditions: temperature, wind speed, wind direction
9. Operator name and certificate number (spuitlicentie)
10. Nozzle type and drift reduction class
11. Water volume per hectare
12. Equipment identifier

xFarm captures most of these. The ones it handles poorly are detailed below.

### Weakness: CTB Registration Number Is Not Auto-Filled

The Dutch CTB (College voor de toelating van gewasbeschermingsmiddelen en biociden) publishes a complete, publicly accessible database of all approved plant protection products with their registration numbers, approved crops, maximum doses, pre-harvest intervals, and buffer zone requirements.

xFarm does not integrate this database. When a farmer adds a product to their inventory, they type the product name and optionally add the registration number manually. Two consequences:

1. **Typographical errors in registration numbers are common.** "CTB/H" vs "CTB-H" vs no prefix at all. The compliance report then contains an invalid registration number.
2. **Maximum dose validation does not happen.** If a farmer enters a dose above the CTB-approved maximum for the crop/target pest combination, xFarm does not warn them. They spray above the legal limit, create a compliance record showing the illegal dose, and submit it.

FarmOS integrates the CTB database. Product selection auto-fills: registration number, label dose range, pre-harvest interval, approved crops, buffer zone requirement, and nozzle classification. The dose entry field shows the legal range for the selected crop. Entries above the maximum are blocked with an explanation.

### Weakness: Weather Is Manually Entered After the Fact

The requirement to record weather conditions at time of application exists because spray efficacy and drift risk depend on conditions during spraying — not before or after. A farmer who sprays at 09:00 and logs the activity at 14:00 is entering weather from memory or from a weather app screenshot they took at the time. Neither is reliable.

xFarm has the farmer's GPS location. It has a weather API. It does not capture and store weather conditions automatically at the time the activity is being performed.

FarmOS auto-captures weather from the KNMI API at the GPS coordinates of the selected field at the logged time. If the activity is logged in real-time, the conditions are captured live. If logged within 6 hours of the activity, the historical conditions are back-filled from KNMI hourly records. The farmer sees the auto-filled values and can correct them if they were in a sheltered location where conditions differed from the nearest station.

### Weakness: BBCH Is Manual or Absent

The spray diary requires the growth stage at time of application. BBCH stage is important because some products are approved only within specific BBCH windows (e.g., Proline EC on wheat: BBCH 37–59 only). An application outside the approved window is not just ineffective — it is illegal.

xFarm has a BBCH field in the spray form. It is a free-text entry. The farmer types a number. xFarm does not validate whether the entered BBCH is consistent with the crop's planting date and accumulated degree days. A farmer who types BBCH 55 on a wheat crop that planted 45 days ago is wrong, and xFarm accepts it silently.

FarmOS calculates expected BBCH from planting date + KNMI thermal time accumulation (base temperature 0°C for wheat). The field auto-populates with the calculated stage. The farmer can override if their crop is ahead or behind, but the starting point is correct, and an entered stage more than 5 BBCH stages outside the expected range triggers a confirmation prompt.

### Weakness: No Bulk Field Selection

A common Dutch arable scenario: the farmer runs a single spray campaign across 8 fields on one day using the same product, dose, and machine. In xFarm, this requires 8 separate activity forms. All 8 forms are identical except the field name and area.

There is no "apply this activity to multiple fields" workflow. The farmer either spends 45 minutes creating 8 forms or creates 1 and retroactively adds notes. Both outcomes are wrong.

FarmOS bulk logging: select multiple fields from the map, enter the product and dose once, enter total start and end time, and FarmOS calculates per-field area from the registered parcel sizes and splits the activity into individual compliance records automatically.

### Weakness: No Pre-Application Validation

Before logging a spray activity, a responsible system should check:

- Is the product approved for this crop in the Netherlands? (CTB database)
- Is the growth stage within the product's approved window?
- Is the operator's spuitlicentie valid on this date?
- Is the planned dose within the annual maximum for this field?
- Does the field border a watercourse requiring a buffer zone?
- Is the wind speed at the current time within the label limit?

xFarm checks none of these before saving. It logs whatever the farmer enters and generates a compliance report from it. The compliance report may describe illegal activity, and neither the farmer nor xFarm knows.

FarmOS runs this checklist silently at save time. Blocking warnings for illegal actions. Non-blocking warnings for edge cases. The compliance record carries a validation timestamp.

---

## Activity Type 2: Fertilisation (Bemesting)

### The Compliance Obligation

Dutch fertilisation law (Meststoffenwet) requires documentation of all nutrient applications. Key constraints:

- Maximum 170 kg organic N per hectare per year (derogation farmers: 230 kg/ha for grass)
- Crop-specific total N limits (e.g., winter wheat: 220 kg N/ha; sugar beet: 150 kg N/ha)
- Application timing restrictions (no spreading during certain periods)
- Manure injection requirements on most soils
- Annual Kringloopwijzer (nutrient cycle report) submission

### What xFarm Does

xFarm records fertiliser applications: product, dose per hectare, date, field. It sums total nitrogen applied per field if the products are correctly configured with their N content. It does not:

- Track organic N separately from mineral N
- Calculate the running balance against the legal limit in real time
- Warn when an application would exceed the crop or field limit
- Generate the Kringloopwijzer input data
- Handle manure application timing restrictions

### What This Costs Dutch Farmers

A Dutch farmer who exceeds the nitrogen limit faces: deduction from CAP payments (cross-compliance penalty), possible criminal prosecution under the Meststoffenwet, mandatory participation in a phosphate reduction program, and reputational damage within the cooperative.

A compliance system that stores nitrogen application records without calculating compliance status is not a compliance system. It is a spreadsheet with a prettier interface.

### What FarmOS Does

Real-time nitrogen balance per field:

```
Keetje Noord — Wheat 2026
Mineral N applied:    148 kg/ha
Organic N applied:     32 kg/ha
Total N applied:      180 kg/ha
Legal limit (wheat):  220 kg/ha
Remaining budget:      40 kg/ha
═══════════════════════════════
[████████████████░░░░] 82% used
```

This bar is visible on the field card, on the fertiliser form before any application, and in a compliance summary dashboard. Applications that would exceed the limit are blocked with an explanation of the shortfall and the legal consequence.

The Kringloopwijzer data export is auto-generated from logged applications at year end.

---

## Activity Type 3: Harvest (Oogst)

### What xFarm Does

A harvest activity records: crop, field, date, yield (tonnes or tonnes/hectare), moisture content (if applicable), and quality parameters (free text). Machines used can optionally be attached.

### Weaknesses

**Yield is manually entered.** Modern combines record yield maps with per-metre-resolution yield data. CLAAS, John Deere, New Holland, and CNH all export this data in ISOXML format. xFarm does not import ISOXML. A farmer with a connected combine manually types a total yield figure into xFarm that their machine already recorded automatically.

**Quality data is a text field.** Aviko and Lamb Weston potato contracts require specific quality documentation: dry matter content, bruise percentage, starch content, skin set score. These are structured data points with defined ranges. xFarm provides a free-text "notes" field. The quality data typed into xFarm is not searchable, not comparable year-on-year, and not exportable in the format the processor requires.

**No lot traceability.** Sugar beet delivered to Cosun, potatoes to Aviko, wheat to the grain merchant — each delivery is a lot with a specific origin (field or field combination), delivery date, quality test result, and contract reference. xFarm does not manage lot traceability from field harvest to processor delivery.

**No yield analysis per field over time.** The most valuable harvest data insight: "Field 7 (Achterste Kamp) has yielded below farm average for 3 consecutive years. Possible causes?" xFarm records each harvest in isolation. Multi-year comparison requires exporting to Excel.

### What FarmOS Does

ISOXML import from combine data — yield map is ingested and averaged to field level automatically, with optional zone-level breakdown if the farmer's combine records high-resolution data. Quality parameters are structured fields (dry matter %, bruise %, protein %, moisture %) with year-on-year comparison. Per-field yield trend shown on the field card: sparkline of the last 5 years with the farm average for context.

---

## Activity Type 4: Scouting (Scouten)

### What xFarm Does

A scouting activity records: date, field, observed pest or disease, severity score, and optionally photos. Can be assigned to an agronomist or completed by the farmer.

### Weaknesses

**No AI photo identification.** A farmer or agronomist photographs a yellowing leaf. The image attaches to the scouting record. xFarm does not analyse the image. The identification relies entirely on the scout's own knowledge. An experienced agronomist will correctly identify early Septoria from late blight from magnesium deficiency. A seasonal worker or a young farmer will not.

GPT-4o Vision, Google Cloud Vision API, and several agriculture-specific computer vision APIs can identify common European crop diseases from photographs with 80–92% accuracy on common diseases (Septoria tritici blotch, late blight, powdery mildew, rust, aphids, flea beetle damage). None of this exists in xFarm.

**No connectivity between scouting observations and activity recommendations.** A scout finds late blight infection at 15% severity on 3 potato fields. This information sits in the scouting log. xFarm does not automatically generate a spray recommendation, check stock for the appropriate fungicide, or schedule a follow-up scouting visit. The observation and the response are completely disconnected.

**No regional disease pressure integration.** Dacom publishes daily late blight infection pressure data for the Netherlands by region, accessible via API. DLV Plant maintains wireworm and Colorado beetle pressure maps. None of this data is integrated into xFarm's scouting module to provide regional context for field observations.

**No offline photo capture.** Rural fields have poor connectivity. The scouting photo must be taken and attached to the form at the time of observation. xFarm's offline mode does not reliably queue photos for later sync. A scout in a Flevoland field without 4G coverage photographs a disease outbreak and later discovers the photo did not save.

### What FarmOS Does

Camera opens directly from the scouting form. Photo is stored locally immediately. AI identification runs when connectivity is available: "This appears to be early Septoria tritici blotch (85% confidence) — earliest stage, limited spread. Recommended action: schedule fungicide application within 5–7 days. Your stock of Bravo 500 is sufficient for 32 ha." The identification is a suggestion, not a prescription — the farmer confirms or overrides. Regional late blight pressure from Dacom is shown as context alongside the field observation.

---

## Activity Type 5: Tillage (Grondbewerking)

### What xFarm Does

Records tillage events: type (ploughing, cultivating, subsoiling, rolling), date, depth, field, machine, operator.

### Weaknesses

**Depth is a text field.** Ploughing depth affects soil structure, organic matter turnover, and compaction pan depth. It should be a numeric field with unit. It is a text field where a farmer types "25 cm" or "25" or "deep" depending on their preference.

**No soil condition recording.** Whether the soil was fit for cultivation at time of entry is agronomically important and legally relevant for some agri-environment scheme conditions. Soil condition (wet / suitable / dry) is not captured.

**No workability model.** The Netherlands has well-characterised soil types with known workability thresholds by moisture content and temperature. A soil workability model — "field 12 (Drechtse polder clay) will be trafficable Thursday based on current drainage rate and precipitation forecast" — would be genuinely useful for planning tillage operations. xFarm records what was done. It never predicts what is possible.

**Cost is never calculated.** Diesel price × litres per hour × hours worked = fuel cost. Machine depreciation per hour + maintenance cost = total cost per operation. This is a standard costing calculation. xFarm records the operation but never prices it.

### What FarmOS Does

Structured depth field with unit (cm/inch). Soil condition selector at time of entry. Workability forecast: based on recent precipitation, soil type, and soil temperature, FarmOS estimates when each field will be trafficable — useful for scheduling cultivation after a wet period. Operation cost auto-calculated from machine hourly rate (entered once in machinery settings) × logged hours.

---

## The Logging Speed Problem

### Current State: xFarm

| Field condition | Time per spray log entry |
|---|---|
| Desktop, office, good connection | 2–3 min |
| Mobile, field, 4G | 4–6 min |
| Mobile, field, 3G or poor connection | 5–9 min |
| Mobile, field, offline | Unreliable / data loss risk |

A Dutch arable farmer doing 3 spray rounds on 60 fields in a season = 180 activity entries. At 5 minutes average = **15 hours of compliance administration per year**.

This is time stolen from the farm. It is the single most legitimate complaint about xFarm in every review on every platform.

### Target State: FarmOS

| Method | Time per spray log entry |
|---|---|
| Voice logging (hands-free) | 15–20 seconds |
| GPS auto-select + smart defaults | 45–60 seconds |
| Bulk multi-field logging | 30 seconds for 6 fields |
| Manual form (fallback) | 2–3 min |
| Offline (any method above) | Same as online |

**Voice logging flow:**

Hold mic button → "Sprayed Proline 0.6 litres per hectare on Keetje Noord, wind was 4 metres, 15 degrees" → LLM extracts: product=Proline, dose=0.6 L/ha, field=Keetje Noord, wind=4 m/s, temp=15°C → pre-filled form shown for confirmation → tap Save.

Total time: 18 seconds. No typing. One hand. Cab door closed.

**GPS auto-select flow:**

Farmer is physically on field 12. Opens FarmOS. App detects GPS within field 12 boundary → field is pre-selected. Last used product on this field is pre-filled. Previous dose is pre-filled. Weather is auto-captured. Operator is the logged-in user. All that remains: confirm area (pre-filled from field registration), tap Save.

Total time: 40 seconds.

**Smart defaults engine:**

FarmOS analyses the last 90 days of activity logs per farmer and builds a default model:
- Most frequently used field-product-dose combinations
- Typical spray timing relative to weather conditions
- Common operator assignments per field
- Average area treated per field vs. registered area (flags anomalies)

When a farmer opens a new spray form, the form is pre-populated with the highest-probability values for each field based on historical patterns. The farmer corrects what is different. They do not start from blank.

---

## The Missing Activity Type: Irrigation (Beregening)

xFarm has no irrigation activity type. This is a significant gap for Dutch vegetable farmers, onion growers, and potato farmers in sandy soil areas (Brabant, Veluwe, Drenthe). Irrigation events require logging for: water use reporting to the water board, soil moisture management records, energy cost accounting, and in some areas, abstraction licence compliance.

FarmOS includes irrigation as a first-class activity type with: water volume applied, source (groundwater, surface water, rain gun/drip), energy consumption, and link to water board licence limits.

---

## The Missing Validation: Pre-Application Checklist

Before any spray application, a professional farmer should confirm:

| Check | xFarm | FarmOS |
|---|---|---|
| Product approved for this crop (CTB) | No | Yes — automatic |
| Dose within label range | No | Yes — blocks if exceeded |
| BBCH within approved window | No | Yes — warns if outside |
| Spuitlicentie valid today | No | Yes — warns 60 days before expiry |
| Buffer zone requirement for this field | No | Yes — calculated from field map |
| Wind speed within label limit | No | Yes — compares to current weather |
| Pre-harvest interval respected | No | Yes — checks harvest date if planned |
| Annual limit for this product on this field | No | Yes — tracks usage vs. max |

Eight checks. xFarm runs zero. FarmOS runs all eight, silently, before save.

---

## The Deleted Activity Problem

When an activity is deleted in xFarm, the compliance record is at risk. If a spray activity is attached to a compliance record required for an RVO inspection, and that activity is deleted (by mistake, by a worker, by a sync error), the compliance chain breaks.

xFarm has no soft-delete for activities. Delete means gone.

In practice this creates a category of compliance error that farmers discover only when an inspector asks for records that no longer exist. The cover-up — re-entering the activity with reconstructed data — is technically falsification of a regulatory record.

FarmOS activities are never hard-deleted. The "delete" action soft-deletes: the activity is archived, invisible in normal views, but recoverable. Compliance records linked to the activity survive the deletion. A restoration flow allows recovery of accidentally deleted activities with full audit trail. If stock was deducted for the activity, the deletion restores the stock and creates a correction movement in the inventory audit log.

---

## The Operator Competency Gap

Dutch spray law requires that the person applying plant protection products holds a valid spuitlicentie (certificate of competence). The licence number must appear on the spray diary record.

xFarm has a "certificate number" field in the spray form. It is a text field. It is optional in some configurations. There is no validation that:
- The number is in a valid format
- The certificate is associated with the named operator
- The certificate is valid on the date of application (they expire every 5 years)
- The certificate holder is registered with the Dutch NVWA

A spray diary signed with an expired or fictitious certificate number exposes the farm to regulatory action. xFarm helps the farmer create this exposure by providing no validation.

FarmOS maintains an operator registry: each operator's spuitlicentie number, expiry date, and allowed activities. When an operator logs a spray activity, their licence is validated against the date. If the licence expired, the activity cannot be saved under that operator. The farm owner receives a notification 60 days before any operator's licence expires.

---

## Summary: How FarmOS Wins This Module

xFarm owns activities by regulatory default — farmers must log spray events and xFarm is the path of least resistance. FarmOS wins by making the path of least resistance also the path of highest compliance and lowest time cost.

The farmer who logs their first spray event in FarmOS and takes 40 seconds instead of 5 minutes will never return to xFarm for this task. That moment of clarity — "this is how it should always have been" — is the product's primary acquisition event.

The farmer who discovers on an inspection day that FarmOS automatically validated every one of their 180 spray events against CTB requirements while xFarm was silently accepting illegal applications will not need a sales call to switch.

**The strategic target:** make the FarmOS activity form so fast, so smart, and so complete that using anything else feels like punishment.

---

*Next document: [05-morning-workflow.md](05-morning-workflow.md)*
