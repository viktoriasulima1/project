# Sprint 21 Real Device Test Matrix

No physical device has yet been tested in this workspace. Fill values from the device itself; do not infer them from Playwright.

| Device | Model | OS | Browser/version | Mode | Storage | Battery mode | Network | Date | Status |
|---|---|---|---|---|---|---|---|---|---|
| A | TBD Android phone | TBD | Chrome TBD | Browser + installed PWA | TBD | TBD | Wi-Fi/mobile | TBD | Unverified |
| B | TBD iPhone | TBD | Safari TBD | Safari + Add to Home Screen | TBD | TBD | Wi-Fi/mobile | TBD | Unverified |

If only one phone is available, leave the other platform “Unverified”. Required conditions per device: online; airplane mode before open; loss while editing; loss immediately after Save; committed response lost; alternating connectivity; Wi-Fi/mobile handoff; slow network; DNS timeout; reopen after hours offline.

For every run capture connectivity wording, draft/queue state, Activity/StockMovement/ComplianceRecord/AuditEvent counts, comprehension, screenshot/video reference and the output of `npm run verify:offline-sync -- --local-draft-id=<id>` with `OFFLINE_VERIFY_FARM_ID` scoped to the pilot farm.
