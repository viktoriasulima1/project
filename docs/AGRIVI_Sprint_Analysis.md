# AGRIVI Sprint Analysis — FarmOS Sprint 1

> **Legal notice:** This document is a competitive analysis based on publicly available information (website, product videos, press releases). No AGRIVI code, design assets, screenshots, or proprietary content has been used or reproduced. All FarmOS design decisions are original.

## What AGRIVI Gets Right

### 1. The "farm record" is the anchor
AGRIVI centers everything around a structured farm record: fields, seasons, crops, activities. This is the right foundation. We adopted the same model: `Farm → Field → Season → Crop → Activity`.

### 2. Spray diary as compliance glue
AGRIVI's spray diary integrates directly with EU regulatory reporting. This is the highest-value compliance feature for European farmers. Our `ComplianceItem` type and the spray_diary module are designed with this in mind.

### 3. Activity logging with weather capture
AGRIVI captures weather snapshot at the time of spraying. We model this with `WeatherSnapshot` embedded in `Activity`. This is critical for legal spray diary validity under EU Directive 2009/128/EC.

### 4. Financial module depth
AGRIVI offers cost/ha tracking per crop, which enables farmers to compare profitability across rotations. We adopt this with `CropFinancial.marginPerHaEur` — the most actionable single metric for a farmer.

### 5. Dashboard as entry point
AGRIVI leads with a farm dashboard. We do the same, with an AI briefing card as the primary differentiator.

## What AGRIVI Does Poorly (Our Opportunity)

| AGRIVI weakness | Our approach |
|---|---|
| Complex UI, many clicks to log an activity | One-step voice/text logging via AI Cockpit (Sprint 2) |
| No proactive AI recommendations | AI Briefing card — deterministic in Sprint 1, Claude-powered in Sprint 2 |
| Expensive (€199+/month) — out of reach for small farms | Target mid-size NL farms (50–300 ha) at €49–€99/month |
| Mobile app is clunky | Mobile-first responsive layout from Sprint 1 |
| Weak CAP eco-scheme tracking | Dedicated CAP module with activity-to-qualification mapping |
| No spray window intelligence | Real-time spray window badge using actual weather API |
| Siloed data — no AI summary across modules | Cross-module AI briefing generated from all farm data |
| European compliance not localized per country | NL-specific: BRP/RVO, Databankenwet, Dutch spray diary format |

## Ideas We Adopted (Transformed, Not Copied)

1. **Farm record structure** → Adopted; simplified with TypeScript strict types
2. **Activity → Weather link** → Adopted; `WeatherSnapshot` in `Activity`
3. **Cost/ha as primary financial metric** → Adopted; shown on dashboard Finance card
4. **Spray diary as compliance module** → Adopted; `spray_diary` ComplianceModule
5. **Dashboard-first UX** → Adopted; extended with AI briefing as hero card

## Ideas We Did Not Adopt

- AGRIVI's agronomist marketplace — out of scope for MVP
- Yield prediction model — needs historical data, Sprint 3+
- Multi-language per-country certification templates — Sprint 3+
- Sensor/IoT integrations — Sprint 4+

## Sprint 1 Competitive Position

FarmOS Sprint 1 is a frontend skeleton with production-quality design system and domain modeling. It is not yet functional in production — but it establishes:

- A richer type model than AGRIVI's public API docs suggest they started with
- An AI-first architecture (briefing engine) with no AGRIVI equivalent
- A design system that is cleaner and more modern than AGRIVI's interface
- NL-specific compliance from day one (BRP, RVO, CAP eco-scheme B)
