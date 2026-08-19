import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Sprint 16 Part 9 — "Do not duplicate business logic in the dashboard.
// Use shared services/resolvers." There's no component-rendering harness in
// this project (no @testing-library/react in devDependencies — the whole
// suite is Node-environment logic tests), so this checks the actual thing
// the rule cares about at the source level: the dashboard page must call
// the same resolver functions the dedicated Finance and Farm Insights pages
// call, not recompute its own version of "real cost" or "real insight".
const dashboardSource = readFileSync(
  join(__dirname, '../../app/(farm)/dashboard/page.tsx'),
  'utf-8',
);

describe('dashboard uses shared resolvers, not duplicated logic', () => {
  // Test 14: Dashboard uses shared finance resolver
  it('imports and calls getFinanceData from the shared finance-data module', () => {
    expect(dashboardSource).toMatch(/import\s*\{\s*getFinanceData\s*\}\s*from\s*['"]@\/lib\/finance-data['"]/);
    expect(dashboardSource).toMatch(/getFinanceData\(farm\)/);
  });

  // Test 15: Dashboard uses shared insight resolver
  it('imports and calls getFarmInsights from the shared farm-insights module', () => {
    expect(dashboardSource).toMatch(/import\s*\{\s*getFarmInsights\s*\}\s*from\s*['"]@\/lib\/farm-insights['"]/);
    expect(dashboardSource).toMatch(/getFarmInsights\(farm\)/);
  });

  it('does not pass the FinancialSnapshot-derived data.finance into the Finance card anymore', () => {
    // The card must receive the live-computed resolver result, not the
    // legacy always-zeroed-for-real-farms FinancialSnapshot fallback.
    expect(dashboardSource).not.toMatch(/FinanceSnapshotCard finance=\{data\.finance\}/);
  });
});
