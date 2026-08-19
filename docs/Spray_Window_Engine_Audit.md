# Spray Window Engine — Audit

**Scope:** `src/lib/spray-window.ts` as of Sprint 5 (0–100 composite score, no hard-blocker separation).
**Audited as:** senior agronomist, Dutch crop protection compliance specialist, decision-engine architect, senior TypeScript engineer, QA lead.
**Verdict up front:** the Sprint 5 engine is a *weather-only heuristic*. It has no concept of product, crop, legal limit, operator licence, or inventory. It must not be shown to a farmer as a spray/no-spray decision without the redesign in Sprint 6.

---

## 1. Every assumption in the current model

| # | Assumption | Where | Why it's a problem |
|---|---|---|---|
| A1 | One universal set of thresholds applies to every product | `SPRAY_LIMITS` constant | Real product labels set per-product wind/temp/humidity/rainfast limits. A systemic herbicide and a contact fungicide do not share a wind limit. |
| A2 | Wind speed alone represents drift risk | `windScore`, `checkSprayHour` | Drift risk depends on nozzle type, boom height, drift-reduction technology (DRT class), and buffer zone requirements — none of which the engine knows. |
| A3 | Open-Meteo's forecast wind/temp/humidity for a 1×1 km grid cell equals on-field conditions | `fetchWeather` → `computeSprayWindows` | Forecast models smooth local variation; field-level wind gusts near hedgerows/buildings can differ substantially. No confidence or uncertainty is exposed. |
| A4 | Precipitation *probability* (not amount, not timing) is what matters for rainfast risk | `precipScore`, `checkSprayHour` | A product's rainfast period (e.g. "no rain within 2 hours after application") requires forward-looking rainfall amount over a specific window, not the probability at that single hour. |
| A5 | The forecast is always fresh | Entire module — no timestamp is threaded through | `fetchWeather` caches for 30 minutes (`next: { revalidate: 1800 }`), but the score never carries a "data age" or "confidence" signal to the farmer. A 29-minute-old forecast is presented with the same certainty as a live reading. |
| A6 | A single composite score is safe to average across hours and days | `averageScore` in `computeSprayWindows` | Averaging can hide a single very poor (illegal) hour inside an otherwise good day. A high average must never be read as "the day is fine." |
| A7 | "Open" (no blockers) is equivalent to "safe/legal to spray" | `isOpen`, `isOpenNow` | The UI (`SPRAY_LABEL`: "Go" / "Check" / "No-go") already frames the binary flag as a go/no-go decision — this is exactly the legally risky framing the current architecture invites. |
| A8 | Dew point / humidity relationship approximates real dew point | `dewPointRiskScore` | `dewPoint = tempC - ((100 - humidity) / 5)` is a crude Magnus-formula-free approximation. It is order-of-magnitude only and is not documented as an approximation to the farmer. |
| A9 | Operator, product, machine, and inventory context is irrelevant to whether spraying is currently permitted | Entire module takes only `HourlyWeather[]` | The engine cannot know: does this operator have a valid spuitlicentie? Is this product registered/expired? Is there enough stock? Is the crop/BBCH stage eligible? All of these are hard legal blockers today handled nowhere. |
| A10 | Wind direction is descriptive only, never a constraint | `windDirectionLabel` | Buffer zone rules in NL (Activiteitenbesluit / spray drift reduction) can require downwind buffer distances to water bodies depending on wind direction relative to the water course. Direction is displayed but never evaluated. |

---

## 2. Every threshold in the current model

| Threshold | Value | Source of truth | Assessment |
|---|---|---|---|
| `windSpeedMaxKmh` | 15 km/h | Hardcoded constant, no citation | Reasonable order-of-magnitude default (NL guidance commonly cites ~5 m/s ≈ 18 km/h, sometimes stricter per product), but presented as fact, not default. Must vary per product/label. |
| `temperatureMinC` | 5 °C | Hardcoded constant | Some products (e.g. certain growth regulators, glyphosate) have higher minimums; some biologicals lower. Single value is a placeholder. |
| `temperatureMaxC` | 28 °C | Hardcoded constant | Chosen to reduce volatility/thermic drift risk generically; real labels vary 20–30 °C. |
| `precipitationProbabilityMax` | 20% | Hardcoded constant | Conflates probability with the actual rainfast constraint (see A4). Not a real regulatory number. |
| `humidityMax` | 90% | Hardcoded constant | High humidity is not itself illegal; it affects droplet evaporation/drift and disease infection risk, not a hard block in most labels. Treating it as a near-blocker (90%) is arguably too permissive as a "soft" signal and too rigid as if it were a limit. |

**None of these five thresholds are sourced from a real product label, Ctgb (College voor de toelating van gewasbeschermingsmiddelen en biociden) registration, or Activiteitenbesluit clause.** They are reasonable illustrative defaults only. This must be stated explicitly in the UI and in code comments — the redesign labels them `MOCK_DEFAULT_PRODUCT_PROFILE`.

---

## 3. Every weight in the current model

| Factor | Weight | Assessment |
|---|---|---|
| Wind | 35% | Justifiably the largest single factor (drift is the dominant spray-day risk) but a fixed weight cannot reflect that wind should be a **hard blocker** past the legal limit, not a fraction of a blended score. |
| Temperature | 20% | Reasonable relative weight, same objection: a hard limit should not be "diluted" by other soft factors. |
| Precipitation probability | 20% | Weight conflates two different concerns: (a) will it rain now (spray effectiveness / wash-off), (b) rainfast period compliance (legal). Only (a) belongs in a soft score. |
| Humidity | 15% | Acceptable as a soft signal only. |
| Dew point risk | 10% | Acceptable as a soft signal, but the underlying formula (A8) is unvalidated. |

**Core defect:** all five factors are blended into one number using multiplication and addition (`computeScore`). This means a very bad wind reading (say, legal-limit-breaching) can be **mathematically offset** by ideal temperature, zero rain, and low humidity, producing a misleadingly high average score. This is the single most dangerous property of the Sprint 5 model and is the primary motivation for Sprint 6's hard-blocker/soft-scoring split.

---

## 4. Missing variables

Variables the engine should account for but currently does not:

- **Rainfall amount and timing** (not just probability) over the product's specific rainfast window.
- **Wind gust speed**, not just sustained wind speed (Open-Meteo exposes `wind_gusts_10m`, not currently fetched).
- **Leaf wetness** — already fetched in `weather.ts` (`leafWetness` field) but never used by `spray-window.ts`. This is a documented "available but unused" gap carried over from Sprint 4/5.
- **Soil temperature / soil moisture** — relevant for pre-emergence herbicides and trafficability, not fetched at all.
- **Forecast confidence / model spread** — Open-Meteo does not expose ensemble spread in the currently-requested fields; the engine has no fallback signal for forecast uncertainty at all.
- **Data recency** — no timestamp comparison between "when was this forecast fetched" and "now."
- **Product identity** — no product ID, active ingredient, or label data reaches the engine.
- **Crop and BBCH stage** — a `FieldSeason.bbchStage` field exists in the schema but is never passed into the spray engine.
- **Operator certification status** — `Employee.certNumber` / `certExpiry` exist in the schema (Sprint 5) but are not cross-checked against spray suitability at all.
- **Inventory sufficiency** — `InventoryItem.currentStock` vs. required dose × area is never checked before suggesting a spray window.
- **Buffer zone / water course proximity** — not modeled; would require field geometry + national watercourse layer (BRP/legger).
- **Drift-reduction technology (nozzle class)** — `Activity.nozzleType` exists as a field on logged activities but is never used as an input constraint before the fact.
- **Frequency / reapplication interval** — number of applications of the same active ingredient already made this season (relevant to resistance management and legal max-application-count per season).

---

## 5. Situations where the score may mislead the farmer

1. **Wind at 14.9 km/h (just under the 15 km/h "hard" cutoff), but gusting to 30 km/h.** `windScore` returns a value close to the worst end of its ramp but `isOpen` remains `true` because gusts are never fetched. The farmer sees "Go."
2. **High average score across a day that contains one illegal hour.** `averageScore` is a plain arithmetic mean; a single non-compliant hour is invisible in the headline number if surrounding hours score near 100.
3. **Forecast fetched 29 minutes ago, conditions have since changed (e.g., a rain shower arrived early).** The score is displayed with the same visual confidence as a live reading — no "as of HH:MM" or staleness indicator exists in the current UI (`WeatherPageClient.tsx` shows no fetch timestamp).
4. **Humidity at 91% (1 point over the 90% "limit").** This alone triggers a hard blocker (`isOpen = false`) even though humidity is not a real legal spray restriction in most cases — it should be a soft signal, not a blocker. This is a **false-negative-by-design** case: the farmer is told "No-go" for a condition that is not actually prohibited by any label or regulation.
5. **Perfect weather, but the operator's spuitlicentie expired yesterday.** The engine has no way to know this and will show a high score / "Go" for an activity that would be illegal to log.
6. **Perfect weather, but the selected product's registration (`registrationNumber`/Ctgb toelating) has lapsed, or the crop is not on the label.** Same failure mode — weather-only scoring is blind to legal eligibility.
7. **Perfect weather, insufficient stock for the planned area.** The farmer plans a spray window around a score that says "excellent" and then discovers mid-application that stock runs out.
8. **Score computed at day granularity averages morning fog/high humidity with a clear afternoon window**, potentially depressing a genuinely excellent afternoon opportunity, or inversely, making a marginal day look acceptable on average when only a narrow slice is actually usable — the current UI does report `nextWindowStart`/`nextWindowEnd`, but the headline number (`averageScore`) is what a scanning user sees first.

---

## 6. False-positive risk register (score says "spray" when it should not)

| Risk | Root cause | Severity |
|---|---|---|
| Legal wind limit exceeded via gusts, not sustained speed | No gust data fetched | High — direct compliance/drift exposure |
| Product-specific limit tighter than generic default (e.g. product requires ≤10 km/h, engine's default allows 15) | No product profile input | High |
| Rainfast period violated despite low "precipitation probability" at the moment of spraying | Probability ≠ rainfall amount/timing over a forward window | High — efficacy and possible re-application legality issue |
| Operator certificate expired | Not modeled at all pre-Sprint-6 | Critical — direct legal violation if logged as compliant |
| Product registration lapsed / crop not on label | Not modeled at all pre-Sprint-6 | Critical |
| Stale forecast presented as current | No data-age signal | Medium — degrades trust, can mislead near cache-expiry boundary |
| Buffer zone / watercourse proximity violated | Not modeled | High (regional, depends on field geometry) |

## 7. False-negative risk register (score says "no spray" when conditions are actually acceptable)

| Risk | Root cause | Severity |
|---|---|---|
| Humidity marginally over an arbitrary 90% cutoff treated as hard blocker | Humidity should be soft-scored, not a blocker, for most products | Medium — costs the farmer a usable window unnecessarily |
| Averaging depresses a genuinely excellent narrow window inside a mixed day | `averageScore` is a flat mean, no "best window" score surfaced prominently | Medium |
| Generic thresholds stricter than the actual product in use | No per-product profile; defaults may be more conservative than necessary | Low–Medium |

---

## 8. Summary of required changes (see Sprint 6 report for what was implemented)

1. Split all legally/agronomically absolute constraints into **hard blockers** that can never be outvoted by a soft score.
2. Re-scope the soft score to genuinely gradient factors only (wind margin, temperature margin, humidity, dew point spread, forecast confidence).
3. Thread **product-specific constraint profiles** through the engine instead of one universal `SPRAY_LIMITS` constant, with clearly labelled mock/default profiles — no invented real legal values.
4. Surface **explainability**: hard blockers, warnings, positive factors, plain-language explanation, best window, confidence, and weather data age — not a bare number.
5. Change all UI copy to indicative language with a persistent disclaimer; remove "Go/No-go" legal-sounding framing.
6. Add gust speed and leaf wetness as evaluated (not just fetched-and-ignored) inputs where available.
7. Add a data-recency ("as of") signal wherever the score is displayed.
