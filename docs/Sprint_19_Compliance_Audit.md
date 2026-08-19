# Sprint 19 — Compliance & Regulatory Data Flow Audit

Full read of `prisma/schema.prisma`, `src/lib/actions/activities.ts`, `src/lib/ctgb-compliance-check.ts`, `src/app/(farm)/compliance/page.tsx`, `src/components/activities/ActivitiesClient.tsx`, and every relevant test file (`activities.test.ts`, `complete-activity.test.ts`, `inventory.test.ts`), done fresh this sprint — not carried over from memory of earlier sprints' summaries. This document is the required Part 1 deliverable: a factual account of what exists today, before any audit-trail/correction/export code is written.

## 1. Activity creation (`createActivity`, `src/lib/actions/activities.ts`)

**What is captured**: `fieldSeasonId`, `type`, `status` (`planned`/`completed`), `date`, `operatorName`, `certificateNumber`, `waterVolumePerHa`, `nozzleType`, `machineId`, `areaHa`, `productId`, `dosePerHa`, `doseUnit`, 5 weather fields, `notes`.

**Where stored**: `activities` table, one row. For a `completed` spray: a `compliance_records` row (framework `EU_SPRAY_DIARY_2009_128_EC`) and a `stock_movements` row (`direction: 'out'`) are created in the same DB transaction.

**Denormalized values**: `ComplianceRecord.data` (JSON) denormalizes `fieldName`, `fieldHectares`, `crop`, `seasonYear` (all read from `Field`/`FieldSeason`/`Season` at the moment of creation) plus `productName`, `productRegistrationNumber`, `ctgbAuthorisationStatusAtCompletion`, `ctgbSourceUrl`, `ctgbFetchedAt` (read from `InventoryItem`/`CtgbProductReference` at that same moment). This denormalization is intentional and already correctly one-way: nothing in the codebase re-reads live Field/Product/Ctgb data to rewrite an existing `ComplianceRecord.data`.

**Currently editable**: Nothing, directly — there is no `updateActivity` action at all. The only way an `Activity` row's own columns change after creation is (a) `completeActivity` (see §2) and (b) `deleteActivity`'s `deletedAt` (see §3).

**Currently deletable**: Yes — `deleteActivity(id)` (§3) applies uniformly to a `planned` or a `completed` activity, with no distinction.

**Original value survives an edit**: N/A today (no edit path exists) — but see §3's finding, which is the actual risk.

**Who / when**: `operatorName` is a free-text field the farmer types (not necessarily the signed-in user), and there is no column recording *which Clerk user* (`clerkUserId`) actually clicked "Save" — only `Activity.createdAt`. For a farm with a single owner account this is low-risk today, but it means "who performed the action" is not currently answerable from the database at all, only "which farm."

**Reason required**: No — activity creation has never required a reason, which is correct (creation isn't a correction).

**Inventory consistency**: Yes, for this path — stock deduction and the `Activity` row are created in one `$transaction`, and the deduction itself uses a guarded raw `UPDATE ... WHERE currentStock >= totalUsed` to prevent a negative-stock race.

**Compliance history consistency**: Yes, for this path — the compliance record is created in the same transaction as the activity and the stock movement, so all three exist or none do.

**Legal/data-integrity risk**: None specific to creation itself.

## 2. Planned → completed transition (`completeActivity`, same file)

**What is captured**: A fresh weather snapshot (temperature/wind/direction/humidity) fetched *at completion time*, replacing whatever was estimated at planning time. Stock is deducted and the compliance record is created here — not at planning time.

**Currently editable**: `completeActivity` can only run once per activity (`if (activity.status !== 'planned') throw`) — a `completed` activity cannot be re-completed, and there is no `revert-to-planned` path. This one-directional guarantee is good and should be preserved.

**Legal/data-integrity risk**: None specific to this transition itself — the real risk is what happens *after* completion (§3).

## 3. Activity deletion (`deleteActivity`, same file) — **the primary finding of this audit**

**Current behavior, read directly from the code**: `deleteActivity(id)` finds the activity (any status, any type, as long as it belongs to this farm and isn't already soft-deleted), reverses every one of its outbound `StockMovement` rows via a compensating `direction: 'correction'` movement, and sets `Activity.deletedAt = now()`. **It applies identically whether the activity is `planned` or `completed`, and whether or not it has an associated `ComplianceRecord`.**

`ActivitiesClient.tsx`'s "Remove" button (line 128-139, `handleDelete`) calls this action unconditionally for every row in the table, with a single `confirm()` browser dialog reading *"Remove this activity? The diary record is retained for compliance. Stock will be restored."* — no reason field, no distinction shown between removing a same-day planned entry versus removing a spray that has already been legally recorded, stocked out, and would show up in a regulator's spray diary.

**What currently protects the underlying data**: `ComplianceRecord.activityId` has `onDelete: Restrict` — so a *hard* delete of an `Activity` row that has a compliance record would fail at the database level. `deleteActivity` never attempts a hard delete (it only sets `deletedAt`), so this Restrict has never actually been exercised in practice; it is a safety net that happens to not be needed by the current code path, not a control that's actively gating anything today.

**Whether the original value survives**: The `Activity` row itself still exists (`deletedAt` is set, not the row removed) and the `ComplianceRecord` row is untouched — so the underlying facts are not destroyed. But every *query* that reads "current" activities filters `deletedAt: null` (see `activities.test.ts`, the isolation spec, and the Compliance page's own record listing does NOT currently filter by activity deletion at all — see §4's finding). The practical effect for a farmer or an inspector using the product's own UI is that a completed, compliance-relevant spray can be made to disappear from `/activities` with one click and one generic confirm dialog, no reason recorded anywhere, and no visible trace in the UI that it ever happened or who removed it.

**Reason required**: No — `deleteActivity` takes only an `id`, nothing else.

**Who / when**: Not recorded anywhere. There is no audit log of any kind in this codebase today (confirmed by grepping the whole `src/` tree — the only "event" concept that exists is `src/lib/product-events.ts`'s `logProductEvent`, which is a `console.log`-only, ephemeral, analytics-oriented function with a closed `ProductEventName` union that has no delete/correction/reversal events, is never persisted to the database, and is explicitly documented as "not an audit trail").

**Inventory consistency**: Yes, mechanically — stock is correctly restored via a compensating movement, not by mutating the original movement's `quantity`. This part of the existing design is already sound and is the right pattern to build correction/reversal on top of (Parts 5-6 of this sprint).

**Compliance history consistency**: **No** — this is the sharpest risk in the whole audit. The `ComplianceRecord` row is preserved, but nothing marks it as belonging to a since-deleted activity. The Compliance page's query (`src/app/(farm)/compliance/page.tsx`, line 28-32) does:

```ts
const records = await db.complianceRecord.findMany({
  where: { activity: { fieldSeason: { field: { farmId: farm.id } } } },
  ...
});
```

This filter does not exclude `activity.deletedAt`. **A soft-deleted activity's compliance record still appears on the Compliance page, indistinguishable from an active one**, with no indication that the underlying activity was removed. Depending on how "delete" is understood by a user, this could read either as a bug (deleted things still show) or as a feature (regulatory history is retained) — but right now it is neither *by design*, it is simply an oversight: the page was never updated to account for `deletedAt` at all.

**Legal/data-integrity risks, summarized**:
1. A completed, compliance-bearing spray can be removed from the farmer-facing activity list with a single generic confirmation and no reason — functionally equivalent to an unaudited "undo" of a regulated record.
2. No audit trail exists anywhere recording who deleted what, when, or why.
3. The Compliance page silently continues to show the compliance record of a deleted activity, with no "this activity was removed" marker — an inspector or the farmer themselves has no way to tell, from the Compliance page alone, that this happened.
4. There is no concept of "correction" at all today — the only lever that exists is delete-and-recreate, which loses the original record's visibility entirely (once deleted, the activity itself vanishes from every farmer-facing list, even though its row and its compliance record still exist in the database).

## 4. Compliance page (`src/app/(farm)/compliance/page.tsx`)

**What it shows today**: The 50 most recent `ComplianceRecord` rows for the farm, each rendered as one line (framework label, field name, crop, product name, date). No filtering, no detail view, no export, no audit history, no correction/reversal actions, no indication of record completeness, no distinction between an active and a since-deleted activity's record (§3).

**Currently deletable from this page**: Nothing — the page is read-only today, which is a reasonable starting point but has no correction mechanism at all, so the only way to change a wrong compliance record today is to delete the underlying activity (§3) and record a new one, silently losing the original.

## 5. Stock movements (`stock_movements` table)

**What is captured**: `inventoryItemId`, optional `activityId`, `quantity`, `direction` (`in`/`out`/`correction`), optional `unitCost`/`notes`, `createdAt`. No `deletedAt`, no versioning — every row is permanent and immutable once created (nothing in the codebase ever calls `stockMovement.update()` or `.delete()` — confirmed by grep).

**Correcting behavior that already exists**: `deleteActivity`'s stock-reversal path already follows exactly the right pattern for Sprint 19 to extend: it never mutates the original `out` movement, it adds a new `correction` movement referencing the same `activityId`. This is the one piece of the current codebase that already embodies the "append, never rewrite" principle Sprint 19 needs everywhere else.

**Gap**: There is no `correlationId` or equivalent linking a stock movement to the *reason* it was created (a normal completion vs. a deletion-triggered reversal are both just rows with `direction`/`activityId` — the only way to tell them apart today is the presence of `notes: 'Stock restored: activity soft-deleted'`, a free-text string, not a structured, queryable field).

## 6. Ctgb snapshots (`CtgbProductReference`, `CtgbUseAuthorisation`, and the JSON denormalized into `ComplianceRecord.data`)

**What is captured, and where**: The live/cached Ctgb authorisation (`ctgb_product_references` + `ctgb_use_authorisations`, shared across the farm, not per-activity) plus a frozen, activity-specific snapshot (`ctgbAuthorisationStatusAtCompletion`, `ctgbSourceUrl`, `ctgbFetchedAt` inside `ComplianceRecord.data`).

**Already immutable**: Confirmed structurally, again this sprint — nothing in the codebase calls `complianceRecord.update()` on the `data` field after creation (grep confirms zero call sites). This is exactly the guarantee Sprint 19 Part 7 requires, and it already holds. What does **not** yet exist: a place to attach a *second, newer* snapshot when a correction changes the product, and no UI that explains why two snapshots differ (there is currently no correction path at all, so this has simply never been needed).

**Gap for Part 7 specifically**: The frozen snapshot captures only 3 fields (`ctgbAuthorisationStatusAtCompletion`, `sourceUrl`, `fetchedAt`) — it does not capture the selected official use, the specific dose/BBCH/PHI/buffer constraints that were checked at the time, a source checksum/version, or whether the check was live/cached/manual/unavailable. `checkCtgbCompliance()` (`src/lib/ctgb-compliance-check.ts`) computes a richer result (`matchedUse`, `blockers`, `warnings`, `status`) at *review* time in the activity dialog, but that richer result is never itself persisted — only the 3 narrow fields above make it into the permanent record. This is a real gap: today's compliance record cannot answer "what dose range was checked against" after the fact, only "was the product authorised."

## 7. Employee/operator and Machine records

**Employee** (`employees` table): `certNumber` (spray-licence certificate number) is stored in plain text with no masking anywhere it's displayed (it currently isn't displayed anywhere outside the Employee management UI itself — it is not shown on the Compliance page, since that page doesn't reference `Employee` at all; `Activity.operatorName` is a free-text string, not a foreign key to `Employee`, so today's spray diary doesn't actually cross-reference the certificate number to the operator who did the work — a real, pre-existing gap, not something this sprint's brief asks to fix, but relevant to Part 15's "employee certificate numbers... display masked by default" once export includes operator detail).

**Machine** (`machines` table): No versioning/audit concerns — `Activity.machineId` is a stable foreign key, `onDelete: SetNull`, so if a machine is later deleted, past activities keep their historical fact intact only as `null` (the machine's name is not denormalized into `ComplianceRecord.data` at all today — a gap for the PDF/CSV export, which needs the machine name to still be retrievable after a machine might be deleted; today it would show blank).

## 8. Current unit/E2E test coverage relevant to this audit

- `activities.test.ts`: covers `deleteActivity`'s soft-delete + stock-reversal behavior (3 tests) with no reason parameter, no status-based restriction, and no audit assertion — consistent with the code, confirming this is the actual, tested, current behavior, not an oversight in the audit.
- `complete-activity.test.ts`: covers the one-directional planned→completed transition and confirms the Ctgb snapshot is frozen at completion time (2 dedicated tests) — this is the existing guarantee Sprint 19 must not weaken.
- No test anywhere asserts anything about deleting a *completed* activity differently from a *planned* one — confirming the gap in §3 is untested, not merely undocumented.
- No test, page, or component anywhere references "audit," "correction," "reversal," "export," or "PDF"/"CSV" (confirmed by grep across `src/` and `e2e/`) — this sprint starts from zero on all of Parts 2-13.

## 9. Summary risk table

| Risk | Severity | Where |
|---|---|---|
| Completed regulated activity can be soft-deleted with one click, no reason, no audit trail | High | `deleteActivity`, `ActivitiesClient.tsx` |
| Deleted activity's compliance record still displays with no "removed" marker | High | Compliance page query |
| No audit trail of any kind (who/when/why) for any regulated action | High | Whole codebase |
| No correction mechanism — only delete-and-recreate, which loses the original | Medium-High | Whole codebase |
| Ctgb snapshot captured at completion is narrower than what was actually evaluated (no matched-use/dose-range/BBCH detail persisted) | Medium | `activities.ts`, `ctgb-compliance-check.ts` |
| No compliance completeness resolver — a farmer cannot see "what's missing" on a record | Medium | Compliance page |
| No export of any kind — a farmer cannot hand an inspector a spray diary document | Medium | Whole codebase |
| Machine name not denormalized — export would show blank for a deleted machine | Low-Medium | `activities.ts` |
| `operatorName` is free text, not linked to `Employee`/certificate | Low (pre-existing, out of this sprint's scope) | `Activity` schema |
| Stock-reversal `notes` field is free text, not a structured correlation key | Low | `stock_movements` |

This audit is the basis for Parts 2-13 of this sprint: the `AuditEvent` model (Part 2) closes the "no audit trail" gap; record versioning + a dedicated correction action (Parts 3-4) closes the "delete-and-recreate loses the original" gap and directly restricts the dangerous `deleteActivity` path found in §3; the reversal workflow (Part 6) becomes the *only* sanctioned way to remove a completed regulated activity's effect, replacing today's unconditional `deleteActivity` for that case; the completeness resolver (Part 8) and redesigned Compliance page (Part 9) close the visibility gaps in §4; and richer Ctgb snapshot capture (Part 7) closes the gap in §6.
