# Spray Window rules

This document describes the implemented resolver; it is not a pesticide label and does not replace Ctgb instructions or professional judgement.

## Inputs

The resolver consumes the existing hourly weather forecast plus optional product, operator, inventory, crop/BBCH and drift context. Product limits remain authoritative when supplied. Missing context is retained as missing/unverified evidence rather than fabricated.

## Weather limits and score

The generic profile uses maximum wind 15 km/h, maximum gust 28 km/h, temperature 5–28 °C, soft humidity 90%, a two-hour rainfast horizon and maximum 1 mm precipitation. Product constraints may narrow these values. The score uses the existing weights: wind 35%, temperature 20%, precipitation probability 20%, humidity 15% and dew-point margin 10%.

Any hard blocker yields `blocked`. Otherwise scores map to `excellent` at 85 or above, `good` at 70, `marginal` at 50 and `poor` below 50. The resolver preserves existing warnings for unavailable gusts, incomplete rainfast horizons and elevated/approaching conditions.

## Context policy

For a planned application, invalid or missing required regulatory/operational context can fail closed. Advisory evaluation reports missing or unverified context without inventing verification. The UI remains informational and shows the indicative-only disclaimer.

## Selection and confidence

The existing best-window algorithm groups suitable hours and prefers the longest window, then the higher average score. Confidence remains based on forecast age, horizon and completeness. No persistence or background automation is performed by this resolver.
