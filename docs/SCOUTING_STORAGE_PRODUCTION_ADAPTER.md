# Scouting production shared-storage adapter

Production requires `SCOUTING_PHOTO_STORAGE_PROVIDER=object_gateway`. Local, in-memory, unavailable and placeholder configurations are rejected when `NODE_ENV=production`. The HTTPS gateway is shared across Next.js nodes and implements private temporary upload, checksum metadata, idempotent finalize, signed read, delete-unfinalized and provider outage responses.

Required server-only variables: `SCOUTING_PHOTO_ENDPOINT`, `SCOUTING_PHOTO_REGION`, `SCOUTING_PHOTO_BUCKET`, `SCOUTING_PHOTO_ACCESS_KEY`, `SCOUTING_PHOTO_SECRET_KEY`, plus signed lifetime and retention. Secrets are never serialized to clients. The gateway/container must enforce private access, encryption at rest, lifecycle cleanup, concurrency-safe finalize and its own multipart/resumable implementation for large objects.

`npm run scouting:storage:cleanup` defaults to dry-run and reports candidate/failed-finalization counts without secrets. Production confirmation additionally requires `SCOUTING_STORAGE_CLEANUP_CONFIRM=YES`; finalized evidence is never deleted by this command.
# Contract status

The shared gateway adapter, strict production validation, safe authenticated diagnostic and `test:storage:contract` command are implemented. The external contract is opt-in and has not been run against a real service; multi-node reachability, private-container policy, encryption, lifecycle and restore evidence therefore remain NO-GO gates.
