# Sprint 19 — Immutable Audit Trail, Compliance Corrections and Export — Report

**Status up front**: every command in the requested validation order passes. `npx prisma generate` (7 migrations applied), `npx prisma migrate status` ("Database schema is up to date!"), `npx tsc --noEmit` (clean), `npx vitest run` (**362/362** passing, up from 282 before this sprint), `npm run build` (clean production build, `/api/compliance/export` present in the route list), `npm run test:e2e` run **twice consecutively** (**53/53** passing both times — 48 pre-existing + 5 new Sprint 19 flows), Clerk test-user count stable at 5 across both runs (no new users created, per the fixed E2E pool established in Sprint 18). Three real bugs were found and fixed during this sprint's own validation — see §13.

---

## 1. Previous audit weaknesses

Full findings in `docs/Sprint_19_Compliance_Audit.md`. In summary: a completed, compliance-bearing spray activity could be soft-deleted from the Activities page with one click and a single generic confirmation dialog — no reason, no audit trail, and no visible marker on the Compliance page that the underlying activity had been removed (the compliance record kept displaying as if nothing had happened). No audit trail of any kind existed anywhere in the codebase. The only way to "fix" a wrong record was delete-and-recreate, which destroyed the original's visibility entirely. The Ctgb snapshot captured at completion time was narrower than what was actually evaluated (no selected use, no dose/BBCH constraints, no source checksum persisted). No compliance completeness resolver, no export of any kind, existed.

## 2. Audit trail architecture

`AuditEvent` (`prisma/schema.prisma`) — one generic, append-only table (`entityType`/`entityId` pointers, not per-entity columns) covering `created`/`planned`/`completed`/`corrected`/`reversed`/`archived`/`restored`/`exported`/`verification_status_changed`/`inventory_adjusted`/`compliance_snapshot_created`. Append-only is enforced twice: application code never calls `.update()`/`.delete()` on it (only `recordAuditEvent()`, `src/lib/audit.ts`, exists), and the database itself rejects UPDATE unconditionally and DELETE unless `app.allow_audit_hard_delete=true` is explicitly set for that transaction (a Postgres trigger installed by this sprint's migration) — a narrow, documented escape hatch used only by whole-farm teardown (this project's own E2E reset helpers; see §13's second bug). One `correlationId` is generated per business transaction and shared by every audit event, stock movement, and compliance snapshot that transaction produces. Full detail in `docs/AUDIT_TRAIL_ARCHITECTURE.md`.

## 3. Completed-record versioning

`Activity` gained `version`, `correctionOfId`, `rootActivityId`, `isReversal`, `correctionReason`, `correctionDiff` (`src/lib/activity-versions.ts` implements chain traversal: `getRootId`, `getVersionChain`, `getEffectiveVersion`, `labelVersion`). A correction or reversal always creates a **new** `Activity` row; the original is never updated. "Effective version" = the chain member nothing else corrects (latest by `createdAt`, since corrections are strictly sequential). The Compliance page's record detail view renders Original/Corrected/Reversed/Current effective record labels per `labelVersion()`.

## 4. Correction workflow

`correctActivity` (`src/lib/actions/compliance-corrections.ts`) — scoped to `type === 'spray'` only this sprint (documented, not silently half-supported for other types). Requires a reason (≥10 characters), records old/new values only for fields that actually changed, verifies product/machine ownership, and is guarded by a real Postgres row lock (`SELECT ... FOR UPDATE`) plus an idempotency key so a double-submit or two genuinely concurrent corrections can never fork the chain. A stale correction attempt (the record changed since the screen opened) returns exactly: *"This record was changed by another action. Reload and review the latest version."* The correction dialog (`CorrectionDialog.tsx`) requires an explicit "Review correction" step showing the computed diff and stock impact before the Submit button becomes enabled.

## 5. Reversal workflow

`reverseActivity` — same locking/idempotency guarantees as correction. Requires a reason, fully restores whatever stock the reversed record consumed via one compensating movement, and creates a new `Activity` row (`isReversal: true`) carrying the same factual snapshot as what it reverses (nothing about what happened changes, only that it no longer counts). A record cannot be reversed twice, and a reversed record cannot be corrected further — both rejected with clear errors. Reversed records are excluded from default compliance totals/exports but remain fully visible in history and in an export when explicitly requested.

## 6. Inventory reconciliation

Every correction/reversal stock change is a **new** `StockMovement` row — the original is never rewritten. Lower corrected quantity → compensating `correction` movement; higher → an additional `out` movement, guarded by the same atomic `WHERE currentStock >= amount` check every deduction in this app already uses (blocks with a clear error if insufficient, never invents stock). A full product swap reverses the old product's quantity and deducts the new product's quantity as two movements. All within one database transaction per action.

## 7. Ctgb snapshot preservation

`src/lib/ctgb-snapshot.ts`'s `buildCtgbSnapshotExtra()` extends the Sprint 18 3-field snapshot with source product id, source version, raw checksum, computed compliance status, and the specific matched official use (dose/BBCH/PHI/buffer constraints actually checked) — wired into `createActivity`, `completeActivity`, and `correctActivity` alike. A correction with a different product computes a fresh snapshot from that product's own current reference data — proven pure and independent of any prior snapshot in `ctgb-snapshot.test.ts`. The historical snapshot on the original record is never touched (nothing calls `.update()` on `ComplianceRecord.data`, structurally, as in Sprint 18).

## 8. Compliance completeness

`src/lib/compliance-completeness.ts`'s `resolveComplianceCompleteness()` — a single, centralized resolver returning `complete`/`incomplete`/`verification_unavailable`/`corrected`/`reversed`, plus `missingFields[]`, `warnings[]`, `sourceStatus`, `effectiveVersion`, `correctionCount`. Precedence: reversed > corrected > verification-unavailable > incomplete > complete. Always labeled "FarmOS record completeness," never "government-certified" or "legally approved" — a manual/unverified product is always flagged with a warning even when every field is technically present.

## 9. PDF export

`src/lib/compliance-export/pdf.ts`, built with `pdf-lib` (newly added dependency — pure JS, no native deps). Renders one bordered block per record rather than a dense table row — a deliberate, documented choice: ~17 fields per spray application cannot fit as readable A4 table columns without clipping something, and a block guarantees "no clipped columns" by construction. Header (farm identity, season/date range, generation timestamp, FarmOS version, export id) and footer (disclaimer, export id, page number) repeat on every page. Operator certificate numbers are masked (last 4 characters only). A plain-text fallback (`buildComplianceDiaryPlainText`) renders the identical facts for a screen reader or simple viewer. Never claims government certification anywhere.

## 10. CSV export

`src/lib/compliance-export/csv.ts` — UTF-8 with BOM (Dutch Excel compatibility), `.`-only decimals, one row per effective record (or per version when correction history is requested), stable column names exactly matching `docs/COMPLIANCE_EXPORT_DATA_DICTIONARY.md`. OWASP-standard formula-injection escaping (a leading `=`/`+`/`-`/`@` gets a `'` prefix). No certificate-number column at all — deliberately absent, not just masked.

## 11. Export provenance

Every export (PDF or CSV) writes one `ComplianceExport` row and one `exported` `AuditEvent` in the same request (`src/lib/compliance-export/provenance.ts`, called from `src/app/api/compliance/export/route.ts` — a Route Handler, not a Server Action, since only a Route Handler can return an arbitrary binary `Content-Disposition` download). The generated file itself is never stored (`storageReference` stays null this sprint). The checksum is a SHA-256 hash of a canonical, sorted view of the exported records' own data — deliberately not the rendered file's bytes, since those always embed a fresh export id/timestamp by design.

## 12. Security

Every correction/reversal/export/detail-view action re-verifies farm ownership on every query (never trusts a client-submitted id past that check) — including the idempotency-check queries themselves, which were found unscoped during this sprint's own security review and fixed before it could leak whether another farm's record had ever been corrected (see §13). Export filters (`fieldIds`/`crops`/`productIds`) only ever narrow an already farm-scoped query — a foreign id simply matches nothing. `deleteActivity` now refuses to delete a `completed` activity at all, directing to `reverseActivity` instead — closing the exact gap found in §1. No multi-user roles exist yet (documented as future work, `docs/AUDIT_TRAIL_ARCHITECTURE.md`).

## 13. Tests and E2E

**362/362 unit tests pass** (80 new this sprint), covering all 32 items from the brief's own numbered list — audit event creation/correlation/append-only/cross-farm-rejection/privacy, correction diff/reason/stale-version/idempotency, inventory reconciliation in both directions, completeness resolver states, Ctgb snapshot purity and freshness, PDF/CSV content and formatting, export checksums and provenance. **53/53 E2E tests pass, twice consecutively** — 48 pre-existing plus 5 new flows (completed-record correction, reversal, PDF export, CSV export, cross-farm attack), all reusing the fixed Clerk pool with zero new users created.

Three real bugs were found and fixed while getting this sprint's own validation to pass — an honest account, not swept under the rug:

1. **A `'use server'` file exported a non-async pure function** (`computeCorrectionPreview`). Next.js requires every export from a `"use server"` file to be an async function — extracted the pure preview-computation logic into its own plain module (`src/lib/correction-preview.ts`), imported by the action file for internal use, imported directly by client components for its types.
2. **The same file also re-exported an imported type via `export type { X }`**, which Next.js's server-actions bundler transform does not correctly distinguish from a value re-export — it generated a broken server-action reference for a type that no longer exists at runtime, producing a real `ReferenceError` that crashed *every* server action in the same bundle (this is why the pre-existing `founder-walkthrough` E2E test also failed until this was fixed — not a regression in that test itself, but a shared-bundle blast radius from this bug). Fixed by having client components import those types directly from the plain module instead.
3. **The new `audit_events` append-only trigger blocked this project's own E2E per-user/whole-database reset helpers** — deleting a Farm cascades onto its `AuditEvent` rows, and the trigger correctly rejected that DELETE since the escape-hatch flag was never actually wired into `reset-user-data.ts`/`reset-db.ts` (only reasoned about at design time, not implemented). Fixed by wrapping both reset helpers' deletions in an explicit transaction that sets `app.allow_audit_hard_delete='true'` for that transaction only.

Two cross-farm idempotency-check queries in `correctActivity`/`reverseActivity` were also found unscoped by farm during a security self-review (not by a failing test) and fixed before they shipped — see §12.

Two minor test-authoring mistakes (not application bugs) were found and fixed: a unit test asserted the wrong Ctgb status for a product with zero uses, and three E2E selectors were ambiguous against the new Compliance page's own filter dropdowns (fixed with more specific locators, `.first()`, or role-scoped queries).

## 14. Manual checks still required

Per the updated `docs/BETA_ACCEPTANCE_CHECKLIST.md` §P: a human should actually open an exported PDF once and confirm it reads well on real A4 (structural correctness — page count, well-formed PDF bytes, content parity via the plain-text fallback — is automated; visual judgment is not). A human should open an exported CSV in Dutch-locale Excel and confirm diacritics/decimals render correctly. A human should read the PDF's field labels and disclaimer as a Dutch farmer would and confirm the audit-history panel's plain-language clarity — automated tests confirm the structure and content exist, not that the wording lands well for a non-technical reader.

## 15. Dutch legal/compliance questions still requiring professional validation

**Audit/regulatory retention duration is not invented by this sprint.** FarmOS's own behavior is simply "never delete" (a safe default in the direction of over-retention), but the actual EU Directive 2009/128/EC and Dutch RVO minimum/maximum retention requirements for a spray diary have not been confirmed by a qualified agricultural-compliance professional — see `docs/COMPLIANCE_RECORD_CORRECTION_POLICY.md`'s "Audit retention" section. Whether "FarmOS record completeness" as computed by this sprint's resolver aligns with what a Dutch inspector would actually check has also not been reviewed by a domain expert — this sprint only guarantees internal consistency (the same facts everywhere), not regulatory sufficiency.

## 16. Exact readiness for pilot use

The audit trail, correction/reversal workflow, and export system are functionally complete, internally consistent (compliance page, PDF, and CSV all read from the same resolver, so they can never disagree), and fully covered by passing automated tests at every layer this sprint touched. **Not yet pilot-ready without**: (a) the manual PDF/CSV/audit-history reads named in §14, (b) the professional legal review named in §15, and (c) extending correction/reversal beyond `type === 'spray'` if the pilot farm needs to correct fertilising/harvest/other activity types (currently out of scope, documented). Ctgb's live API remains blocked with HTTP 403 (Sprint 18 finding, unchanged this sprint) and BRP/PDOK remains live-verified (also unchanged) — neither was in this sprint's scope to revisit.
