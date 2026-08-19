# Weather Risk resolver audit

## Baseline and scope

- Global resolver findings before Stage 9: **437**.
- Targeted findings in `src/lib/scouting/weather-risk.ts`: **6**.
- Targeted findings after: **0**.
- Global resolver findings after: **431**.

The six findings were the final English `why`, `recommendedAction` and input-fact sentences returned by `resolveWeatherRisk`. They were display-only and were not persisted.

## Real implementation and consumers

`resolveWeatherRisk()` is currently called only by unit tests. Production Field Detail, Field Map, Scouting and Farm Insights call `resolveFieldHealthStatus()` directly and do not supply a computed Weather Risk result. Dashboard, Daily Briefing, Work Orders, reports and exports do not consume this resolver. Therefore Stage 9 does not claim integrations, fixtures, provider/offline behaviour or user-visible sections that do not exist.

| Source/function | Existing rule | Former prose | Consumer | Priority/confidence/CTA | Proposed code | Metadata | Persistence |
|---|---|---|---|---|---|---|---|
| `weather-risk.ts` / missing input branch | Any required input absent | Risk cannot be calculated; scout manually | Unit tests only | no priority; low; manual scouting | `INSUFFICIENT_MEASURED_INPUTS` / `SCOUT_MANUALLY` | missing-input codes and supplied measurements | display-only |
| same / favourable branch | 10–24 °C AND RH ≥85% AND rain ≥1 mm | warm/humid/wet may favour development; inspect | Unit tests only | no priority; medium; inspect | `FAVOURABLE_WARM_HUMID_WET_CONDITIONS` / `INSPECT_FIELD` | crop, stage and measurements | display-only |
| same / moderate branch | RH ≥75% OR rain ≥0.5 mm | some conditions may favour development | Unit tests only | no priority; medium; normal scouting | `SOME_FAVOURABLE_CONDITIONS` / `CONTINUE_NORMAL_SCOUTING` | crop, stage and measurements | display-only |
| same / low branch | Below both moderate thresholds | below thresholds | Unit tests only | no priority; medium; normal scouting | `BELOW_RISK_THRESHOLDS` / `CONTINUE_NORMAL_SCOUTING` | crop, stage and measurements | display-only |

Stage 9 adds deterministic priority values only as canonical presentation ordering (high 1, moderate 2, low 3, unavailable 4); it does not change risk selection or any production priority model because none consumes this resolver.

## Explicit exclusions

No frost, heat, wind, accumulated rain, stale forecast, provider fallback, offline cache, field-accessibility, disease-specific model, Work Order block or weather-page rule exists in this resolver. They were not invented. Spray Window remains separate and unchanged.
