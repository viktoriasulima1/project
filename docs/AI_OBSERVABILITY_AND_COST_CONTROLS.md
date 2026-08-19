# AI observability and cost controls

`AiRequestMetadata` stores request type, farm/user reference, provider/model,
checksum, prompt/schema version, timestamps, duration, token counts/cost when
reported, safe result and retry count. Raw prompts, records, authorization
headers, API keys and audio are prohibited.

Controls currently implemented:

- per-user Activity parse daily limit;
- per-farm parse and briefing limits;
- duplicate checksum cache and concurrent request dedupe;
- briefing refresh cooldown;
- provider timeout and bounded output tokens;
- monthly estimated-cost ceiling;
- circuit opens after three recent provider/validation failures;
- rule-based briefing and deterministic parser fallback.

Provider-specific retry classification and a cumulative daily token ceiling
remain required before production provider GO. Authentication/configuration
errors must never be retried or shown raw to farmers.
