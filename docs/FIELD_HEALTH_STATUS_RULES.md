# Field health status rules

`resolveFieldHealthStatus()` is the shared deterministic resolver. Precedence is: severe unresolved observation → `attention_required`; overdue scouting or high explainable weather risk → `inspect_soon`; open evidence/moderate risk → `monitoring`; recent evidence with no open issue → `no_current_issue`; otherwise → `insufficient_data`.

Every result includes severity, explanation, primary evidence, action, freshness and confidence. Weather risk says conditions *may favour* development and never asserts presence. Version: `scouting-weather-v1`; missing measured inputs yield `unavailable`.
