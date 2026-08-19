# Pilot Backup and Restore Test

Status: **NOT EXECUTED — backup readiness unverified**.

Before pilot use, enable daily managed backups, record retention, create one manual backup, restore it into a separate verification database, apply no writes to the source, and compare counts for farms, fields, inventory, activities, compliance records, stock movements, audit events and compliance exports. Verify Activity offline identifiers/idempotency keys and correlated audit chains.

Record provider, backup ID/date, restore target, elapsed time, counts, relation checks, operator and deletion date. Pilot remains NO-GO until a restore passes.
