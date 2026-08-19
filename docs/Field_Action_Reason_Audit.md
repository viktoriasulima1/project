# Field Action Reason — Audit

Date: 2026-07-27. Scope of Resolver Localization Stage 1: the Field Detail action
availability resolver only.

## Before

| Source | Function | Consumer | Decision | English text (before) | Stable code | Metadata |
| --- | --- | --- | --- | --- | --- | --- |
| `lib/field-economics.ts` | `fieldActionAvailability` | `FieldActionsBar` | `add_revenue` w/o season | "Start a season before recording revenue." | `NO_ACTIVE_SEASON` | `{ actionType }` |
| `lib/field-economics.ts` | `fieldActionAvailability` | `FieldActionsBar` | `allocate` offline | "Reallocation requires an internet connection because multiple field totals must be updated atomically." | `OFFLINE_ONLY` | `{ actionType }` |
| `lib/field-economics.ts` | `fieldActionAvailability` | `FieldActionsBar` | `correct`/`reverse`/`export_report` offline | "This action needs an internet connection and is unavailable offline." | `OFFLINE_ONLY` | `{ actionType }` |
| `lib/field-economics.ts` | `lastSyncedLabel` | `FieldActionsBar` | offline banner | "Based on data last synchronized at {date}." | (UI key `fields.actions.lastSyncedAt`) | date formatted at UI |
| `components/fields/FieldActionsBar.tsx` | `LABEL` map | self | action button text | "Add expense", "Correct a record", … (9) | (UI keys `fields.actions.labels.*`) | — |

The two offline reasons differed only in **wording**, not decision — both map to
`OFFLINE_ONLY` (codes are unrelated to wording, per the brief). No codes were
invented for branches that don't exist: only `AVAILABLE`, `OFFLINE_ONLY`,
`NO_ACTIVE_SEASON` have a real current decision.

Targeted resolver-audit baseline: **field-economics.ts = 23**; the field-action
prose above (5 strings) was part of it.

## After

- Extracted to **`src/lib/field-actions.ts`** (pure; no i18n import): returns a
  discriminated `FieldActionAvailability = { available:true; code:'AVAILABLE' } |
  { available:false; code:'OFFLINE_ONLY'|'NO_ACTIVE_SEASON'; metadata:{ actionType } }`.
- `field-economics.ts` field-action prose removed: **23 → 18** (remaining 18 =
  break-even/completeness prose, out of this stage's scope).
- **`field-actions.ts` resolver audit = 0** (targeted file complete).
- Global resolver total: **527 → 522**.
- Adapter `src/i18n/adapters/field-action.ts` (exhaustive switch + `never` guard +
  safe `actions.reasons.unavailable` fallback) translates codes to
  `fields.actions.reasons.*` (×4). Action labels → `fields.actions.labels.*`;
  offline banner date → `fields.actions.lastSyncedAt` (locale-formatted).

Decisions verified unchanged by characterization tests
(`src/lib/__tests__/field-actions.test.ts`, incl. the full online×season truth
table vs the old boolean contract).
