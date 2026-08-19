# Sprint 26 — AI current-state audit

Date: 2026-07-17

## Reality before Sprint 26

| Surface | Classification | Evidence |
| --- | --- | --- |
| Dashboard “AI briefing” | deterministic rule | Top Farm Insights converted to cards; no model call |
| Farm Insights | scoring model + deterministic rules | weighted seven-dimension priority resolver; explicitly labelled rule-based |
| `/ai` | deterministic rule UI | renders Farm Insights, not a chatbot or LLM |
| `generateDailyBriefing()` | legacy deterministic rule | no longer the live Dashboard source; no external call |
| Field operational status | deterministic rule | status precedence in `field-operations.ts` |
| WorkOrder readiness | deterministic rule | inventory/machine/certificate blockers |
| Spray suitability | deterministic rule over external forecast and Ctgb facts | advisory weather plus authoritative product checks |
| Economics signals | deterministic rule | shared FarmEconomicSignals resolver |
| Weather | external statistical forecast | Open-Meteo data; FarmOS does not train the model |
| Natural-language Activity logging | missing before Sprint 26 | only structured Activity form existed |
| External LLM | missing before Sprint 26 | no SDK, API key or model call in product path |
| “AI-first”, Claude cockpit and predictive claims in older roadmap documents | marketing/roadmap only | not shipped functionality |

The visible card now says **Daily Farm Briefing · Rule-based farm facts**. The
stale comment promising a later Claude replacement was removed. Historical
roadmap documents remain historical evidence and must not be read as current
product claims.

## Authoritative components retained

Farm Insights, OperationalPriority, FieldOperationalStatus, resource readiness,
SpraySuitability, Ctgb validation, compliance completeness and economics signals
remain the sources of truth. The Sprint 26 provider can explain or extract text;
it cannot replace these resolvers.
