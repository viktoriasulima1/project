# Crop growth-stage policy

- Stage system is extensible; BBCH is the initial system.
- Crop/FieldSeason, observed time, code, label, source, confidence and observer are required evidence.
- A correction creates a linked version and requires a reason; it does not rewrite history.
- Current effective stage is the newest explicitly observed or corrected effective record.
- No calendar-only advancement is permitted. Expected stages are suggestions awaiting farmer confirmation.
- Compliance reads the effective record; an Activity keeps its own frozen stage-at-work value.
