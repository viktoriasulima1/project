# Weather Risk rules

Version: `scouting-weather-v1`.

Weather Risk is a deterministic indicator, not a diagnosis. Every result has `diagnostic: false` and `requiresFieldConfirmation: true`. It never authorizes treatment or recommends a pesticide.

## Inputs and precedence

Required inputs are crop growth stage, temperature in °C, relative humidity percentage and rain in millimetres. Crop is retained as canonical farmer/domain data. `observedAt` and `now` remain accepted for compatibility but do not affect v1; adding freshness decisions would change behaviour and is outside Stage 9.

1. If any required measured input is missing: `unavailable`, low confidence, `INSUFFICIENT_MEASURED_INPUTS`.
2. If temperature is 10–24 °C inclusive, humidity is at least 85%, and rain is at least 1 mm: `high`, medium confidence, `FAVOURABLE_WARM_HUMID_WET_CONDITIONS`.
3. Otherwise, if humidity is at least 75% or rain is at least 0.5 mm: `moderate`, medium confidence, `SOME_FAVOURABLE_CONDITIONS`.
4. Otherwise: `low`, medium confidence, `BELOW_RISK_THRESHOLDS`.

No `none` or `critical` state exists. Unavailable never becomes low/no risk.

## Canonical evidence

Complete results contain typed crop-stage, measured-temperature, measured-humidity and measured-rain evidence. Incomplete results contain typed missing-input codes. No formatted units, provider payload, errors, notes or final prose are returned.

## Current integration boundary

The resolver has no production caller today. Field Health accepts only a separately supplied canonical level and retains its completed decisions unchanged. There is no Weather Risk interaction with Work Order readiness, provider caching, reports, maps, Dashboard or Daily Briefing in the implemented product.
