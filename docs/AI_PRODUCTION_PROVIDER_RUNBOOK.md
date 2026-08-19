# AI production provider runbook

Production requires a real server-only endpoint/key/model, bounded timeout and
cost/rate configuration. Placeholder keys become unavailable mode. The
deterministic test provider is refused in production unless the explicit E2E or
emergency allow flag is present. Provider failure never blocks rule-based
briefing or manual Activity entry.

Run the optional synthetic contract separately:

`AI_CONTRACT_TEST=true npm run test:ai:contract`

It refuses deterministic mode and real farm data, validates structured output,
and reports provider name, latency and token usage. It never writes an Activity.
Before pilot approval, record timeout, invalid-key and quota classification,
EU DPA/retention/training settings, monthly ceiling and circuit-breaker recovery.
Never expose key/error bodies in health endpoints or browser bundles.
