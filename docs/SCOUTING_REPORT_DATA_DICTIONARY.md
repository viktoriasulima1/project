# Scouting report data dictionary

CSV stable columns: `export_id`, `visit_id`, `field`, `crop`, `visit_date`, `observer`, `bbch`, `observation_id`, `category`, `issue`, `certainty`, `severity`, `status`, `affected_percent`, `description`, `photo_count`, `annotation_summary`, `work_order_id`.

PDF groups the same farm-scoped evidence by visit and includes field/crop, observed BBCH, visit/observer, observations, status/severity/certainty, affected percentage, photo metadata, annotation count, Work Order link identifier, generated timestamp and export ID. It never embeds a permanent/signed URL. Current PDF photo evidence is metadata/annotation summary, not thumbnail binary.

Every export carries SHA-256 response provenance in `x-export-checksum`, an export ID, app version, actor, filters and record count in the append-only audit event. All formats state that unconfirmed symptoms/suggestions are not diagnoses and do not authorize treatment; Ctgb remains authoritative.
