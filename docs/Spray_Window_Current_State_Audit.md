# Spray Window — current-state audit

Date: 2026-07-31

## Classification

Case A applies: FarmOS already has a real Spray Window resolver and real production consumers. Stage 10 localizes that existing contract; it does not add agronomic rules, a provider, persistence, a workflow, or a new UI.

## Existing implementation

- Domain resolver: `src/lib/spray-window.ts`.
- Weather consumer: `src/app/(farm)/weather/page.tsx` and `src/components/weather/WeatherPageClient.tsx`.
- Activity suitability action and dialog: `src/lib/actions/spray-suitability.ts` and `src/components/activities/ActivityDialog.tsx`.
- Farm Insights consumer: `src/lib/farm-insights.ts`, presented by the AI page.
- Weather data remains supplied through the existing Open-Meteo integration and existing cache path.
- Product registration, labels and limits remain Ctgb-derived where product context exists.

## Behaviour boundary

- The resolver evaluates wind, gust, temperature, humidity, rainfast precipitation, dew-point margin and leaf wetness using its existing limits.
- Product, operator, inventory, crop/BBCH and drift context retain their existing fail-closed behaviour for planned applications and advisory warnings otherwise.
- Activity suitability remains advisory in the existing dialog; Stage 10 does not make a resolver status a new submit blocker.
- Work Orders do not call this resolver. No readiness or dispatch feature was added.
- Dashboard has a separate simplified weather status. It was not silently replaced or presented as the Spray Window resolver.
- The resolver has no persistence contract. Therefore there is no legacy Spray Window record migration; persisted briefing prose remains readable through the existing compatibility path.

## Audit conclusion

The audit found 16 presentation strings in the real resolver contract. They were eligible for canonical-code extraction without changing decisions. Targeted resolver audit baseline: 16. Global resolver audit baseline: 431.
