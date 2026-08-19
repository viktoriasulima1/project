# Compliance Record Correction Policy

This document explains why FarmOS never edits a completed regulated record directly, how correction differs from reversal, how inventory stays reconciled, what "effective version" means, what this project currently does (and does not) guarantee about audit retention, and how a correction or reversal is represented in an export. Written for both the farmer using the product and anyone reviewing FarmOS's compliance posture.

## Why completed records cannot be edited directly

A completed spraying activity is, factually, a claim: *this product, at this dose, was applied to this field, on this date, by this operator.* Once that claim has been acted on — stock deducted, a compliance record created, possibly already exported to an inspector — silently rewriting it destroys the ability to answer two questions that matter for regulatory trust: *what did the record say at the time*, and *who changed it, when, and why*.

FarmOS has no "Edit" action for a completed activity. There is no button, server action, or code path that mutates a completed `Activity` row's own fields, its `ComplianceRecord.data`, or its historical `StockMovement` rows. The only way to change what a completed record says is `correctActivity` (Part 4), and the only way to negate its effect is `reverseActivity` (Part 6) — both described below.

## Correction vs. reversal

**Correction** — one or more fields on a completed spray were wrong (treated area, dose, water volume, operator, machine, nozzle, actual date/time, BBCH, notes, weather, or even the product itself). A correction:
- creates a **new** `Activity` row referencing the one it corrects (`correctionOfId`)
- requires a reason (minimum 10 characters — long enough to actually explain something)
- records the old and new value of every field that changed (`correctionDiff`)
- reconciles inventory for exactly the difference (see below) — never re-deducts or re-restores the full original quantity
- gets its own compliance snapshot, including its own fresh Ctgb verification pass
- never touches the original row, its compliance record, or its stock movements

**Reversal** — the application did not actually happen, was a duplicate, or was recorded entirely by mistake. A reversal:
- creates a **new** `Activity` row (`isReversal: true`) referencing the one it reverses
- requires a reason
- fully restores whatever stock the reversed record had consumed, via one compensating movement
- carries the same factual snapshot as what it reverses (nothing about "what was recorded" changes — only that it no longer counts)
- is excluded from default compliance totals and default exports, but remains visible in full history and in an export when explicitly requested

**Rule of thumb**: if the record is *substantively still true but a detail was wrong*, correct it. If the record *shouldn't count at all*, reverse it. Reversal is never used as a shortcut for "I don't want to write out what actually changed" — see Part 6's explicit constraint: reversal is not a normal edit mechanism.

A record that has already been reversed cannot be corrected further, and a record cannot be reversed twice — both are rejected with a clear error, not a silent no-op.

## Inventory reconciliation

Every stock change from a correction or reversal is **additive** — a new `StockMovement` row, never a rewrite of an old one:

- Correcting a lower quantity (e.g. 20 L → 16 L) adds a `+4 L` `correction` movement.
- Correcting a higher quantity (e.g. 20 L → 24 L) adds a `+4 L` `out` movement, subject to the same atomic, guarded stock check every other deduction in this app uses (`UPDATE ... WHERE currentStock >= amount`) — if there isn't enough stock for the additional amount, the correction is blocked with a clear error, exactly like recording a brand-new activity with insufficient stock.
- Correcting the product entirely reverses the old product's full quantity and deducts the new product's full quantity as two separate movements.
- A reversal restores the full quantity in one compensating movement.

Every movement created this way carries the same `correlationId` as the correction/reversal's audit event, so the full set of consequences from one action can be queried together.

## Effective version

A completed activity that has never been corrected is its own "effective version." Once corrected, the chain (original → correction → correction → ...) has exactly one effective member: the most recently created one that nothing else has since corrected or reversed. The Compliance page, exports, and totals always read from the effective version — the original and every intermediate correction remain fully visible in a record's history, but are not double-counted as separate active applications.

## Audit retention

Every `created`/`planned`/`completed`/`corrected`/`reversed`/`exported`/`inventory_adjusted`/`compliance_snapshot_created`/`verification_status_changed` action writes an append-only `AuditEvent` row (`docs/AUDIT_TRAIL_ARCHITECTURE.md` has the full model). Regulatory records — activities, compliance records, and audit events — are not deleted through ordinary account cleanup. The one exception, deliberately narrow: this project's own E2E test-database reset helpers, which operate only against an isolated `farmos_e2e` database, gated behind explicit environment flags, never against a real farm's data.

**This project does not invent a statutory retention duration.** EU Directive 2009/128/EC and Dutch RVO record-keeping obligations carry real minimum retention periods, and getting that number wrong (in either direction) is a legal question, not an engineering one. A qualified professional (agricultural law / compliance advisor) should confirm the actual applicable retention period for a Dutch arable farm's spray diary before this product is relied on for real regulatory retention planning. Until that review happens, FarmOS's own behavior is simply: **never delete**, which is a safe default in the direction of over-retention, not under-retention.

## Export representation

- The **current effective version** of each record is what an export shows by default.
- **Reversed records are excluded by default** — they can be included via "include reversed records."
- **Correction history** (every version, not just the effective one) is available via "include correction history," off by default (a spray diary export is normally about what's currently true, not a change log).
- **Incomplete records are included but visibly marked**, never silently hidden — a missing field is a real gap the farmer or an inspector should be able to see, not something FarmOS hides to make the export look cleaner.
- A corrected record's export line always reflects the **current, corrected** values — the original values remain retrievable through the Compliance page's own record-detail / audit-history view, not duplicated into the export by default.

## What FarmOS does not claim

FarmOS does not certify legal compliance, does not claim government certification of any record, and "FarmOS record completeness" (Part 8's resolver) is never described as equivalent to "legally compliant" or "government-approved." A complete record means every field this resolver checks for is present and, where applicable, Ctgb-verified — it is a data-completeness signal, not a legal opinion.
