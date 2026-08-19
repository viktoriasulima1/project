# Spray Window Resolver Audit

Date: 2026-07-31

## Canonical contract

The domain result now exposes canonical status, summary, confidence and disclaimer codes plus structured signal codes and metadata. It no longer composes English blocker, warning, positive-factor, explanation or disclaimer prose.

The 32 signal codes represent only branches that already existed. No separate action-code family was invented because the resolver never owned a canonical action or CTA; navigation and submission remain responsibilities of existing consumers.

## Preserved rules

- Default limits remain wind 15 km/h, gust 28 km/h, temperature 5–28 °C, soft humidity 90%, rainfast horizon 2 hours and rain limit 1 mm.
- Product-specific limits still override defaults where available.
- Score weights remain wind 0.35, temperature 0.20, precipitation probability 0.20, humidity 0.15 and dew-point margin 0.10.
- Status remains blocked when any hard blocker exists; otherwise score thresholds remain excellent ≥85, good ≥70, marginal ≥50 and poor below 50.
- Data confidence and best-window selection are unchanged. Window ranking still prefers duration and then average score.
- Missing context remains distinguishable from verified failure. No missing value is converted into a safe result or zero.

## Consumers and presentation

`src/i18n/adapters/spray-window.ts` is the single four-locale presentation adapter for nl-NL, en-GB, pl-PL and de-DE. Weather, Activity suitability and Farm Insights use it. Unknown runtime codes fall back to localized safe wording and never expose a raw token.

## Audit result

- Targeted Spray Window resolver findings: 16 → 0.
- Global resolver findings: 431 → 415.
- Decision thresholds, scoring, ordering, provider, cache, persistence and authorization: unchanged.
- Global resolver localization: NO-GO; unrelated debt remains.
