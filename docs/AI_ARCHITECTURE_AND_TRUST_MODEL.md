# AI architecture and trust model

## Stage 16 API boundary

Activity parsing exposes canonical validation/rate-limit errors only. Provider failures remain behind deterministic fallback; output stays review-only and cannot persist an Activity. CI live/paid calls: 0.

FarmOS uses four layers:

1. Authoritative deterministic engines produce priorities, blockers and facts.
2. `buildDailyFarmContext()` emits a bounded active-farm snapshot. Every fact has
   type, value, source, related ID, timestamp, freshness, confidence and route.
3. A vendor-neutral `AIProvider` may improve wording or extract candidates.
4. Zod output validation, farm-scoped entity resolution and existing Activity
   validation reject unsupported output. The farmer reviews and confirms.

The provider never receives full database rows. Context checksums exclude the
generation timestamp, enabling stable caching. A model briefing is accepted
only when it preserves deterministic item order and cites existing fact IDs.
Invalid, timed-out, unavailable or policy-limited output becomes a rule-based
briefing rather than a blank card.

Provider configuration is server-only: `AI_API_KEY`, `AI_API_ENDPOINT`,
`AI_MODEL`, `AI_TIMEOUT_MS`, `AI_MAX_OUTPUT_TOKENS`, `AI_DAILY_FARM_LIMIT` and
`AI_DISABLED`. The domain layer imports no vendor SDK. Production must also set
provider retention/training controls contractually; application configuration
alone cannot prove a provider's policy.

Threat boundaries:

- Client input never selects `farmId`.
- Farmer text is untrusted data, not system instruction.
- Model-returned IDs are ignored; IDs come from active-farm resolution.
- HTML/Markdown is not rendered; output is plain React text.
- Provider errors are converted to safe categories.
- AI output cannot invoke server actions or save an Activity.
- Ctgb, certificate, stock, machine, weather and compliance blockers always win.
# Stage 8 economic grounding

Economic briefing facts now originate from the same canonical signal list as Dashboard and Farm Insights. A provider may rewrite wording but cannot change fact identity, priority, selected field or allowed route. Caching, cooldown, circuit breaker, observability and cost limits are unchanged.

# Stage 9 Weather Risk trust boundary

`scouting-weather-v1` now emits canonical evidence and explicitly declares `diagnostic: false` and `requiresFieldConfirmation: true`. It cannot assert disease presence, authorize treatment or recommend a pesticide. It is not currently a Daily Briefing fact or production UI input; no AI integration is claimed or added by Stage 9.
