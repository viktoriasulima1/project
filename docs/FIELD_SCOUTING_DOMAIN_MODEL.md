# Field scouting domain model

`ScoutingVisit` is one inspection of one farm-owned Field and its current FieldSeason. It records time, observer, confirmed GPS evidence, optional weather snapshot and overall condition. It is not a completed Activity.

`ScoutingObservation` is one immutable evidence item within a visit. Category, issue text, certainty, severity, affected area, confidence and lifecycle status are separate. Corrections point to prior evidence; resolution preserves the original. A follow-up WorkOrder is optional and exact-one.

`CropStageRecord` is an append-only observed stage version. One row is effective per FieldSeason at application level; correction creates a replacement linked to its predecessor. Calendar and weather models may suggest but never silently advance it.

`ScoutingPhoto` stores authenticated storage metadata, checksum and annotation separately from the original object. Full binaries are never stored in PostgreSQL. `PhotoSuggestion` is reviewable provider output, never a confirmed agronomic fact.
