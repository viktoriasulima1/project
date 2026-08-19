# Sprint 27 field-scouting audit

Before Sprint 27, scouting existed only as `ActivityType.scout`; issue details were free text in `Activity.notes`. `FieldSeason.bbchStage` held one mutable integer and Activity held a frozen application-stage value, but no observed-stage history or auditable correction chain existed. There was no ScoutingVisit/Observation domain, historical comparison, observation-to-WorkOrder link, farm-scoped photo store, annotation model, or offline photo queue.

The field map showed operational Work Order status and live foreground geolocation, not crop health. Field Detail was economics-led. Daily Briefing and Farm Insights had weather/operational facts but no persisted scouting evidence. `diseaseRiskScore` and legacy `Field.status` could not provide source-traceable health evidence and must not be described as diagnosis.

Existing offline Activity drafts are user/farm scoped and exact-one, but did not support scouting visit graphs or binary photos. No safe object-storage implementation existed. Competitor-parity gaps therefore included structured visits, multiple observations, stage history, evidence photos, health prioritisation, issue resolution and reports.

Sprint 27 introduces the independent evidence model and deterministic resolver. Authenticated binary delivery, offline binary recovery and physical phone validation remain explicit pilot gates rather than being claimed from metadata-only automated validation.
