# Financial offline synchronization policy

- Supported offline draft types are expense, purchase, harvest, and revenue.
- Every draft has stable `localDraftId`, `idempotencyKey`, user/farm namespace, payload, status, and timestamps in IndexedDB.
- Database uniqueness plus a canonical submission hash provides exact-one creation and rejects reuse of a key with different data.
- Sync uses the existing cross-tab Web Lock/Safari lease, safe retry, conflict state, and per-user/farm isolation.
- Confirmed drafts discard detailed local business payload and retain only the receipt/server identifier.
- Deleted references, closed seasons, duplicate invoices, invalid allocations, currency changes, and ownership mismatches require review rather than silent rewriting.
- Correction, reversal, reallocation, valuation-policy changes, and report generation are online-only.
- The server is authoritative. Offline purchase/fuel prices are previews based on last-synchronized values.
