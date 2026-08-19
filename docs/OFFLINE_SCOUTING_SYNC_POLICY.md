# Offline scouting synchronization policy

Implementation update: a separate versioned IndexedDB database stores visit, observation, stage, independent idempotency keys, photo Blobs and normalized annotations. Visit sync precedes per-photo upload; partial failure preserves the graph and Blob. Metadata recovery JSON explicitly excludes photo binaries and is not represented as a complete backup.

A local visit graph is scoped by Clerk user, farm, local visit and observation. Stable UUID plus submission hash provides exact-one retry semantics; same ID with changed content becomes a visible conflict. Server ownership always derives from session. A deleted field, changed FieldSeason/crop, partial upload or changed session must stop synchronization for review; observations are never moved silently.

Photos use checksum-based upload idempotency and retry from the failed object. Recovery export must say whether binary photos are embedded; references alone are not sufficient recovery. External photo AI never runs offline.

The existing Activity queue does not yet persist this new visit/photo graph. Until the dedicated IndexedDB graph and physical restart/reconnect tests pass, offline scouting with photos is NO-GO.
