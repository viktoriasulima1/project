import type { z } from 'zod';

/**
 * Maps a Zod validation issue to a farmer-facing, field-scoped message.
 *
 * The farmer must NEVER see raw enum internals such as
 * "Invalid option: expected one of good | satisfactory | poor | critical".
 * Kept as a pure module (not inside the 'use server' action) so it is directly
 * unit-testable and reusable.
 */
export function friendlyScoutingIssue(issue: z.ZodIssue): string {
  const field = String(issue.path[0] ?? '');
  switch (field) {
    case 'overallCondition':
      return 'Choose a valid overall crop condition before saving.';
    case 'fieldSeasonId':
      return 'Select a field before saving.';
    case 'visitDate':
      return 'Enter a valid visit date.';
    case 'observations':
      return 'Add at least one observation with a description before saving.';
    default:
      return 'Please review the highlighted field before saving.';
  }
}
