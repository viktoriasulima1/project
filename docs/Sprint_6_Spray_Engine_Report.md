# Sprint 6 — Spray Decision Engine Validation and Safety

**Scope:** `src/lib/spray-window.ts` and its two UI consumers (`src/app/(farm)/weather/page.tsx`, `src/components/weather/WeatherPageClient.tsx`), plus the dashboard's day-level spray badge (`src/components/farm/WeatherCard.tsx`). No unrelated modules were added.

**Companion document:** [docs/Spray_Window_Engine_Audit.md](Spray_Window_Engine_Audit.md) — full audit of the Sprint 5 model's assumptions, thresholds, weights, and mislead-risk register.

---

## 1. Assumptions found (summary — full detail in the audit)

- One universal threshold set (`SPRAY_LIMITS`) stood in for every product's actual label — no product ever had its own wind/temperature/rainfast requirements.
- Wind speed alone represented drift risk; gusts were never fetched.
- Rainfall *probability* was used as the rainfast-compliance signal instead of forecast rainfall *amount* over the actual rainfast window.
- The forecast was always treated as fresh — no data-age or confidence signal reached the user.
- Averaging five weighted factors into one blended score meant a bad wind reading could be mathematically offset by good temperature/humidity, hiding the single most dangerous condition.
- "Open" (no blockers) was treated as equivalent to "safe/legal to spray," and the UI said so directly (`Go` / `No-go`).
- A latent timezone bug: `new Date(hour.time)` and `new Date().toISOString().slice(0,10)` parsed Open-Meteo's Europe/Amsterdam wall-clock strings using the *server's* local timezone, silently producing wrong hour/date comparisons on any server not itself running in Amsterdam time (or exactly on a UTC day boundary during DST).
- Operator certification, product registration, crop/BBCH eligibility, inventory sufficiency, and nozzle/drift-reduction status were not modelled at all — a perfect weather score could be shown for an application that would be illegal on non-weather grounds.

## 2. Hard blockers added

All of the following now force `status: 'blocked'` for an hour, regardless of how favourable other factors are:

| Hard blocker | Trigger |
|---|---|
| Wind (sustained) | `windSpeed > profile.maxWindSpeedKmh` |
| Wind (gust) | `windGust > profile.maxWindGustKmh` (new: gusts are now fetched from Open-Meteo and evaluated, not just sustained speed) |
| Temperature | outside `[profile.minTemperatureC, profile.maxTemperatureC]` |
| Hard humidity limit | `relativeHumidity > profile.hardMaxHumidityPct` (only when a profile explicitly sets one — humidity is otherwise soft-scored only, per the audit's finding that it is not a genuine limit for most products) |
| Rainfast violation | actual forecast rainfall (mm) summed over the next `profile.rainfastHours` hours exceeds `profile.maxPrecipitationDuringRainfastMm` — uses real precipitation amount, not probability |
| Product registration | `profile.registrationValid === false`, or (in `planned-application` mode) no real product selected at all |
| Operator certification | missing or expired `certExpiry`, or (in `planned-application` mode) no operator context provided |
| Inventory sufficiency | `availableStock < requiredQuantity`, or (in `planned-application` mode) no inventory context provided |
| Crop/BBCH eligibility | crop not in `profile.eligibleCrops`, or BBCH stage outside `profile.eligibleBbchRange`, or (in `planned-application` mode) unconfirmed when the profile restricts eligibility |
| Drift-reduction nozzle | `profile.driftReductionRequired` is true and no confirmed drift-reduction nozzle, or (in `planned-application` mode) unconfirmed |

**Design decision — advisory vs. planned-application mode:** the engine has two modes. `advisory` (default, used by the general Weather page) surfaces missing operator/inventory/crop/machine context as **warnings** — a farmer glancing at the weather page hasn't necessarily picked a product or operator yet. `planned-application` (intended for a specific logged/planned activity) treats the same missing context as **hard blockers** — fail closed, not fail open, exactly as the sprint brief's hard-blocker list implies ("missing product registration," "missing machine/nozzle information where required"). Wiring `planned-application` mode into the actual `SprayDiaryDialog` pre-submit flow is **not done in this sprint** — see §6.

A high soft score can never override any of the above: `status = hardBlockers.length > 0 ? 'blocked' : statusFromScore(score)` is unconditional.

## 3. Scoring changes

- Score is now explicitly a **soft-quality-only** composite: wind margin (35%), temperature margin (20%), precipitation probability (20%), humidity (15%), dew point margin (10%) — same weights as Sprint 5, but every one of these factors is now purely gradient (the things that used to be hard-limit-adjacent, like wind and temperature, are additionally hard-blocker-gated above their limit, rather than only softly discounted).
- `averageScore` (flat mean across the day) is retained for backward compatibility but is explicitly documented as informational only — the audit's finding (a single blocked hour can hide inside a good average) is called out directly in the field comment, and the UI no longer treats it as the headline number.
- The headline `score`/`status` is now the **representative moment** — "now" if within the fetched data, otherwise the best available window — not a flattened day average.
- Thresholds moved from a single hardcoded `SPRAY_LIMITS` constant to a `SprayProductProfile` passed in via `options.productProfile`, defaulting to `MOCK_DEFAULT_PRODUCT_PROFILE` (`isMockDefault: true`) when none is supplied. No real product/legal values were invented — the mock profile is explicitly labelled as indicative-only in its own `name` field and is surfaced in every result via `productProfile.isMockDefault`.

## 4. Explainability added

Every result (per-hour and day-summary) now returns, instead of a bare number:

- `score` (0–100, informational — never authoritative on its own)
- `status`: `blocked | poor | marginal | good | excellent`
- `hardBlockers[]`, `warnings[]`, `positiveFactors[]` — plain-language strings
- `explanation` — a built sentence combining the representative status, its leading reason, and the day's best window (or a "no suitable window" notice)
- `bestWindowStart` / `bestWindowEnd` — the single longest non-blocked contiguous run, tie-broken by highest average score
- `confidence`: `low | medium | high`, derived from weather-data age *and* forecast horizon (a fresh 90-day-out forecast is still low-confidence; a fresh same-day forecast is high-confidence)
- `weatherDataAge` — minutes since the forecast was actually retrieved (see §7 for the caching bug this required fixing)
- `disclaimer` — the exact required text, attached to every result
- `productProfile: { id, name, isMockDefault }` — so the UI can flag when generic defaults are in effect

The weather page now shows a status badge (`Blocked` / `Poor` / `Marginal` / `Good` / `Excellent`), a two-column positive-factors/warnings list, the built explanation sentence, the confidence + forecast age, and a persistent disclaimer bar. The dashboard's compact spray badge was relabelled from `Go` / `Check` / `No-go` to `Suitable` / `Marginal` / `Avoid`, with the "Spray" label itself now reading "Spray (indicative)".

## 5. Tests added

`src/lib/__tests__/spray-window.test.ts` — 30 new tests, all passing, covering exactly the required list:

- hard blocker overrides score (2 tests, including a wind-gust-specific case)
- high score with rainfast violation returns blocked (2 tests, including the non-violating control case)
- stale weather lowers confidence (3 tests: stale, fresh, and unknown-age)
- no suitable window (1 test)
- marginal wind (1 test)
- temperature outside configured range (3 tests, including a custom tighter profile)
- missing product profile (2 tests: advisory-mode warning vs. planned-application-mode hard blocker)
- dew point risk (2 tests: narrow margin warning, wide margin positive factor)
- best window selection (2 tests: longest run wins, and a same-length tie-break by average score)
- deterministic output (1 test: identical inputs produce `toEqual`-identical results)
- invalid or incomplete weather data (3 tests: unknown date, missing gust data, empty hours array)
- timezone/DST handling for Europe/Amsterdam (3 tests: summer DST date rollover, winter non-DST date rollover, and correct "now" hour location from a UTC instant)
- planned-application compliance-context blockers (4 additional tests: missing operator, expired certificate, insufficient inventory, and the clean-pass case)

Full suite: **57/57 passing** (27 pre-existing + 30 new). `tsc --noEmit`: 0 errors.

## 6. Remaining agronomic/legal validation needs

- **No real product database is wired in.** `SprayProductProfile` is a complete type, but every actual spray decision today falls back to `MOCK_DEFAULT_PRODUCT_PROFILE`. Real profiles must be sourced from each product's Ctgb (College voor de toelating van gewasbeschermingsmiddelen en biociden) registration/label — wind, temperature, humidity, rainfast hours, buffer zone, eligible crop/BBCH, and drift-reduction requirements all vary per product and are not yet populated anywhere.
- **`planned-application` mode is not wired into any UI flow yet.** `SprayDiaryDialog` still logs activities without querying operator cert status, inventory sufficiency, or crop/BBCH eligibility through this engine. The types and hard-blocker logic exist and are tested; the DB queries connecting them to a real farm/operator/product/field at submit time are a follow-up task.
- **Buffer zone and watercourse proximity are typed (`bufferZoneMetres`) but not evaluated.** Doing so needs field geometry plus a national watercourse layer (legger), which is out of scope here.
- **The dew point approximation (`dewPointMargin`) is a simplified, Magnus-formula-free estimate**, explicitly commented as order-of-magnitude only. It should be replaced with a validated psychrometric formula before being used for anything beyond an advisory nudge.
- **The rainfast look-back window sums the current hour's own forecast rainfall plus the following hours.** This is a conservative, defensible choice, but no product label was consulted to confirm whether the current hour's precipitation should count toward the window — an agronomist should confirm this convention.
- **Humidity is now soft-only by default** (per the audit's recommendation), with an optional `hardMaxHumidityPct` for products where it genuinely is a label limit. No such real values have been entered for any product.

## 7. What must be verified by a real Dutch agronomist / compliance specialist before beta

1. **Every numeric default in `MOCK_DEFAULT_PRODUCT_PROFILE`** (15 km/h wind, 28 km/h gust, 5–28°C, 90% humidity, 2h rainfast, 1mm rainfast threshold) — these are illustrative engineering defaults, not sourced from any label or regulation, and must never reach a farmer as if they were.
2. **The rainfast-window convention** (does the spraying hour's own rainfall count, or only subsequent hours?) against actual Ctgb label wording.
3. **Whether humidity should ever be a hard blocker** for specific product classes (the engine now defaults it to soft-only, with an opt-in hard override per profile) — this should be checked per active-ingredient class, not assumed universal.
4. **Buffer zone distances and the wind-direction-relative-to-watercourse rule** under the Activiteitenbesluit — not modelled at all yet; needs a domain expert to specify before it's built.
5. **Spuitlicentie (operator certificate) rules** — the engine treats a missing/expired cert as an absolute block in `planned-application` mode; confirm this matches actual enforcement practice (e.g., are there any narrow legal exceptions?).
6. **Maximum applications per season / resistance management rules** — `maxApplicationsPerSeason` is typed but has no computation behind it (would need season-to-date activity counts per active ingredient).
7. **The specific product profiles themselves**, once real Ctgb data is sourced — an agronomist must review each profile before it's used to gate a real farmer's spray decision, since the engine's hard-blocker logic will enforce whatever profile it's given exactly as specified.
