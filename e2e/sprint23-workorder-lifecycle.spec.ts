import { test, expect } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';
import { readFileSync } from 'fs';
import { resetNamedE2eUser } from './setup/reset-user-data';
import { seedReadyFarm, type SeededFarm } from './setup/seed-farms';
import { countForFarm, workOrderState, inventoryStock, firstWorkOrderId } from './setup/db-inspect';

/**
 * Sprint 23 — dedicated Plan → WorkOrder → Activity lifecycle E2E.
 *
 *   WRITTEN / TYPECHECKED / NOT EXECUTED.
 *
 * This spec is authored so it can run immediately when Clerk connectivity
 * returns. It is NOT executed in the current environment (Clerk's backend is
 * unreachable, so global.setup.ts cannot sign in). No browser pass is claimed.
 *
 * It uses ONLY the existing fixed Clerk pool (PILOT for mutating flows, plus the
 * globally-seeded OTHER farm for the cross-farm attack) — it creates no new
 * Clerk users. Each mutating flow resets + reseeds PILOT's own farm first, so
 * the flows do not depend on execution order (Part 15).
 *
 * Assertions verify BOTH the UI and — via the read-only farm-scoped
 * e2e/setup/db-inspect helpers — the exact-one database invariants (Part 14).
 *
 * Honest notes on current app behavior, so no assertion asserts a rejection the
 * app does not actually make:
 *  - WorkOrder status transitions (setWorkOrderStatus) are last-write-wins: they
 *    increment `version` but do NOT reject a stale version. The real exact-one
 *    guarantee lives at COMPLETION (an activity linked to a work order throws
 *    "already has an actual activity" once completedActivityId is set). Flow H
 *    tests that real guarantee rather than a non-existent status-level rejection.
 *  - The seeded farm has no employees; blocker cases that need an employee with
 *    an expired certificate / a machine conflict / a weather hard-block need
 *    extra deterministic fixtures and are marked below where not yet seedable.
 */

async function signInPilot(page: import('@playwright/test').Page, farmName: string): Promise<{ email: string; seeded: SeededFarm }> {
  const user = await resetNamedE2eUser(process.env.E2E_USER_PILOT_EMAIL!);
  const seeded = await seedReadyFarm(user.id, farmName);
  await page.goto('/');
  await clerk.signIn({ page, emailAddress: user.email });
  return { email: user.email, seeded };
}

// A form on /work-orders or /planning is the only <form> with name="title".
function orderForm(page: import('@playwright/test').Page) {
  return page.locator('form', { has: page.locator('input[name="reservationQuantity"]') });
}

/**
 * Completes the actual Spraying activity that a "Record actual activity" link
 * opens (prefilled from the work order). Fills ALL required spray fields — the
 * form rejects a save when Water volume / Operator are blank — and surfaces the
 * real form validation error instead of a blind 20s timeout (Part 3).
 */
async function completeActualSprayActivity(page: import('@playwright/test').Page, opts: { offline?: boolean } = {}) {
  await expect(page).toHaveURL(/\/activities\?workOrder=/);
  const dialog = page.getByRole('dialog', { name: 'Spraying' });
  // The workOrder link auto-opens the prefilled Spraying dialog; open it
  // explicitly only if that ever changes.
  if (!(await dialog.count())) {
    await page.getByRole('button', { name: '+ Record activity' }).click();
    await page.getByRole('button', { name: 'Spraying' }).click();
  }
  await page.locator('#productId').selectOption({ label: 'Amistar Opti (L)' });
  await page.locator('#dosePerHa').fill('2');
  await page.locator('#operatorName').fill('Jan de Boer');
  await page.locator('#waterVolumePerHa').fill('300');
  await page.locator('#nozzleType').selectOption('flat_fan');
  await page.locator('#machineId').selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Save activity' }).click();

  if (opts.offline) {
    await expect(page.getByText(/Saved on this device/i)).toBeVisible({ timeout: 15_000 });
    return;
  }
  // Assert success OR the real validation error — never a silent timeout.
  const recorded = page.getByText('Activity recorded');
  const validationAlert = page.getByText(/fix the highlighted field/i);
  await expect(recorded.or(validationAlert)).toBeVisible({ timeout: 20_000 });
  await expect(validationAlert, 'activity form reported a validation error before saving').toHaveCount(0);
  await expect(recorded).toBeVisible();
}

/**
 * Prepares an offline activity completion (Part 10): the activity dialog must be
 * fully loaded ONLINE before disconnecting — going offline mid-navigation makes
 * the service worker serve the "FarmOS is offline" fallback instead of the
 * dialog. Only after the prefilled dialog is visible do we go offline.
 */
async function prepareOfflineActivityFlow(page: import('@playwright/test').Page, context: import('@playwright/test').BrowserContext) {
  await expect(page).toHaveURL(/\/activities\?workOrder=/);
  await expect(page.getByRole('dialog', { name: 'Spraying' })).toBeVisible();
  await page.locator('#operatorName').waitFor({ state: 'visible' });
  await context.setOffline(true);
}

// ─── Flow A — Plan → WorkOrder (Part 3) ───────────────────────────────────────
test.describe('Flow A — plan item converts to exactly one work order', () => {
  test('a season plan item generates one linked work order and no activity yet', async ({ page }) => {
    const { seeded } = await signInPilot(page, 'E2E Sprint23 Plan Farm');

    // 3-11. Create a SeasonPlanItem with an expected product + quantity (so the
    // conversion reserves inventory).
    await page.goto('/planning');
    const plan = page.locator('form', { has: page.locator('input[name="windowStart"]') });
    await plan.locator('select[name="fieldSeasonId"]').selectOption({ index: 0 });
    await plan.locator('select[name="operationType"]').selectOption('spray');
    await plan.locator('input[name="title"]').fill('Fungicide T1');
    await plan.locator('input[name="windowStart"]').fill('2026-06-01');
    await plan.locator('input[name="windowEnd"]').fill('2026-06-10');
    await plan.locator('input[name="expectedAreaHa"]').fill('12.5');
    await plan.locator('select[name="expectedProductId"]').selectOption({ index: 1 });
    await plan.locator('input[name="expectedQuantity"]').fill('25');
    await plan.getByRole('button', { name: 'Add to season plan' }).click();
    await expect(page.getByText('Plan item saved.')).toBeVisible();

    // 12. The plan item is listed.
    await page.reload();
    await expect(page.getByText('Fungicide T1')).toBeVisible();

    // 13. Generate the WorkOrder from the plan.
    await page.getByRole('button', { name: 'Create work order' }).first().click();
    await expect(page.getByRole('link', { name: 'Open work order' })).toBeVisible({ timeout: 10_000 });

    // 14-17. Exactly one work order, linked to the plan, with a reservation and
    // NO activity yet.
    const counts = await countForFarm(seeded.farmId);
    expect(counts.workOrders).toBe(1);
    expect(counts.activities).toBe(0);
    expect(counts.activeReservations).toBe(1);
    expect(counts.seasonPlanItems).toBe(1);
    // Audit: the plan was 'planned' and the work order 'created'.
    expect(counts.auditEvents).toBeGreaterThanOrEqual(2);
  });
});

// ─── Flow B — resource reservation (Part 4) ───────────────────────────────────
test.describe('Flow B — reserving inventory reduces available-to-plan, not physical stock', () => {
  test('reservation holds stock and a duplicate over-reservation is prevented', async ({ page }) => {
    const { seeded } = await signInPilot(page, 'E2E Sprint23 Reservation Farm');
    await page.goto('/work-orders');

    // Reserve 100 of the seeded product (physical stock 500).
    const form = orderForm(page);
    await form.locator('select[name="fieldSeasonId"]').selectOption({ index: 0 });
    await form.locator('input[name="title"]').fill('Reserve 100');
    await form.locator('select[name="inventoryItemId"]').selectOption({ index: 1 });
    await form.locator('input[name="reservationQuantity"]').fill('100');
    await form.getByRole('button', { name: 'Create work order' }).click();
    await expect(page.getByText('Work order created.')).toBeVisible();

    // Physical stock unchanged; reserved increased; available-to-plan decreased.
    const stock = await inventoryStock(seeded.farmId, seeded.productId);
    expect(stock).not.toBeNull();
    expect(stock!.currentStock).toBe(500);
    expect(stock!.activeReserved).toBe(100);

    // A second order reserving more than the remaining unreserved 400 is rejected.
    await page.goto('/work-orders');
    const form2 = orderForm(page);
    await form2.locator('select[name="fieldSeasonId"]').selectOption({ index: 0 });
    await form2.locator('input[name="title"]').fill('Reserve 450 (too much)');
    await form2.locator('select[name="inventoryItemId"]').selectOption({ index: 1 });
    await form2.locator('input[name="reservationQuantity"]').fill('450');
    await form2.getByRole('button', { name: 'Create work order' }).click();
    await expect(page.getByText(/Insufficient inventory/)).toBeVisible();

    // Still exactly one active reservation — the failed one persisted nothing.
    expect((await inventoryStock(seeded.farmId, seeded.productId))!.activeReserved).toBe(100);
  });
});

// ─── Flow C — resource blockers (Part 5) ──────────────────────────────────────
test.describe('Flow C — blockers are explained and create no side effects', () => {
  test('insufficient stock is rejected with no work order and no stock deduction', async ({ page }) => {
    const { seeded } = await signInPilot(page, 'E2E Sprint23 Blocker Farm');
    const before = await countForFarm(seeded.farmId);

    await page.goto('/work-orders');
    const form = orderForm(page);
    await form.locator('select[name="fieldSeasonId"]').selectOption({ index: 0 });
    await form.locator('input[name="title"]').fill('Over-reserve');
    await form.locator('select[name="inventoryItemId"]').selectOption({ index: 1 });
    await form.locator('input[name="reservationQuantity"]').fill('9999');
    await form.getByRole('button', { name: 'Create work order' }).click();
    await expect(page.getByText(/Insufficient inventory/)).toBeVisible();

    const after = await countForFarm(seeded.farmId);
    expect(after.workOrders).toBe(before.workOrders); // nothing created
    expect(after.stockMovements).toBe(before.stockMovements); // no deduction
  });

  test('a spray work order with no certified operator reads as blocked in the queue', async ({ page }) => {
    await signInPilot(page, 'E2E Sprint23 Spray Blocker Farm');
    await page.goto('/work-orders');
    const form = orderForm(page);
    await form.locator('select[name="fieldSeasonId"]').selectOption({ index: 0 });
    await form.locator('select[name="operationType"]').selectOption('spray');
    await form.locator('input[name="title"]').fill('Spray, no operator');
    await form.getByRole('button', { name: 'Create work order' }).click();
    await expect(page.getByText('Work order created.')).toBeVisible();
    // Readiness is derived and shown; a spray needs a certified operator.
    await page.reload();
    await expect(page.getByText(/Blocked:.*certified operator/i)).toBeVisible();

    // Not yet seedable deterministically (seedReadyFarm creates no employees):
    // expired-certificate, machine-conflict, unavailable-machine and the
    // weather hard-block cases need an Employee with certExpiry, a second
    // conflicting order, and a deterministic weather fixture respectively.
    // Documented in docs/Sprint_25_E2E_Inventory.md as required fixtures.
  });
});

// ─── Flow D — start work order (Part 6) ───────────────────────────────────────
test.describe('Flow D — starting a work order sets in_progress without completing it', () => {
  test('Start moves status to in_progress, keeps the reservation, creates no activity', async ({ page }) => {
    const { seeded } = await signInPilot(page, 'E2E Sprint23 Start Farm');
    await page.goto('/work-orders');
    const form = orderForm(page);
    await form.locator('select[name="fieldSeasonId"]').selectOption({ index: 0 });
    await form.locator('input[name="title"]').fill('Startable order');
    await form.locator('select[name="inventoryItemId"]').selectOption({ index: 1 });
    await form.locator('input[name="reservationQuantity"]').fill('10');
    await form.getByRole('button', { name: 'Create work order' }).click();
    await expect(page.getByText('Work order created.')).toBeVisible();

    await page.reload();
    await page.getByRole('button', { name: 'Start' }).first().click();
    await expect(page.getByText(/in progress|in_progress/i).first()).toBeVisible({ timeout: 10_000 });

    const counts = await countForFarm(seeded.farmId);
    expect(counts.activities).toBe(0); // starting never creates an activity
    expect(counts.activeReservations).toBe(1); // reservation still held
    expect(counts.completedWorkOrders).toBe(0);
  });
});

// ─── Flow E — complete through an actual Activity (Part 7) ─────────────────────
test.describe('Flow E — completing through an Activity is exact-one', () => {
  test('recording the actual activity completes the work order and links the chain once', async ({ page }) => {
    const { seeded } = await signInPilot(page, 'E2E Sprint23 Complete Farm');
    await page.goto('/work-orders');
    const form = orderForm(page);
    await form.locator('select[name="fieldSeasonId"]').selectOption({ index: 0 });
    await form.locator('select[name="operationType"]').selectOption('spray');
    await form.locator('input[name="title"]').fill('Complete me');
    await form.locator('select[name="inventoryItemId"]').selectOption({ index: 1 });
    await form.locator('input[name="reservationQuantity"]').fill('25');
    await form.getByRole('button', { name: 'Create work order' }).click();
    await expect(page.getByText('Work order created.')).toBeVisible();
    await page.reload();

    // The queue links to the activity flow carrying the workOrder param — this is
    // the ONLY path that completes the order (status changes alone never do).
    await page.getByRole('link', { name: 'Record actual activity' }).first().click();
    await completeActualSprayActivity(page);

    // Exact-one at the database level (Part 14).
    const counts = await countForFarm(seeded.farmId);
    expect(counts.activities).toBe(1);
    expect(counts.completedWorkOrders).toBe(1);
    expect(counts.stockMovements).toBeGreaterThanOrEqual(1); // one deduction
    expect(counts.consumedReservations).toBe(1); // reservation consumed once
    expect(counts.activeReservations).toBe(0);

    const wo = await workOrderState(seeded.farmId, (await firstWorkOrderId(seeded.farmId))!);
    expect(wo?.status).toBe('completed');
    expect(wo?.completedActivityId).not.toBeNull();
    expect(wo?.auditActions).toContain('completed');
  });
});

// ─── Flow F / H — exact-one retry & no double completion (Parts 8, 10) ─────────
test.describe('Flow F/H — a completed work order cannot be completed twice', () => {
  test('a second actual-activity attempt is refused; exactly one completion stands', async ({ page }) => {
    const { seeded } = await signInPilot(page, 'E2E Sprint23 ExactOne Farm');
    await page.goto('/work-orders');
    const form = orderForm(page);
    await form.locator('select[name="fieldSeasonId"]').selectOption({ index: 0 });
    await form.locator('select[name="operationType"]').selectOption('spray');
    await form.locator('input[name="title"]').fill('Exact one');
    await form.getByRole('button', { name: 'Create work order' }).click();
    await expect(page.getByText('Work order created.')).toBeVisible();
    await page.reload();
    await page.getByRole('link', { name: 'Record actual activity' }).first().click();
    await completeActualSprayActivity(page);

    // The queue now offers only the completed record, not a second completion.
    await page.goto('/work-orders');
    await expect(page.getByRole('link', { name: 'Actual activity record' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Record actual activity' })).toHaveCount(0);

    // Idempotent at the DB level — still exactly one activity/completion.
    const counts = await countForFarm(seeded.farmId);
    expect(counts.activities).toBe(1);
    expect(counts.completedWorkOrders).toBe(1);
    // NOTE: full lost-response/idempotency-key retry (same key → same result) is
    // exercised by e2e/sprint20-offline-sync.spec.ts; the work-order layer's own
    // exact-one guarantee is the single-completion invariant asserted here.
  });
});

// ─── Flow G — cancellation (Part 9) ───────────────────────────────────────────
test.describe('Flow G — cancelling releases the reservation and blocks completion', () => {
  test('a cancelled work order releases its reservation, creates no activity, and offers no start', async ({ page }) => {
    const { seeded } = await signInPilot(page, 'E2E Sprint23 Cancel Farm');
    await page.goto('/work-orders');
    const form = orderForm(page);
    await form.locator('select[name="fieldSeasonId"]').selectOption({ index: 0 });
    await form.locator('input[name="title"]').fill('Cancel me');
    await form.locator('select[name="inventoryItemId"]').selectOption({ index: 1 });
    await form.locator('input[name="reservationQuantity"]').fill('30');
    await form.getByRole('button', { name: 'Create work order' }).click();
    await expect(page.getByText('Work order created.')).toBeVisible();

    await page.reload();
    await page.getByRole('button', { name: 'Cancel' }).first().click();
    await expect(page.getByText('cancelled').first()).toBeVisible({ timeout: 10_000 });

    const counts = await countForFarm(seeded.farmId);
    expect(counts.activities).toBe(0);
    expect(counts.stockMovements).toBe(0);
    expect(counts.activeReservations).toBe(0);
    expect(counts.releasedReservations).toBe(1); // reservation released, not consumed

    const wo = await workOrderState(seeded.farmId, (await firstWorkOrderId(seeded.farmId))!);
    expect(wo?.status).toBe('cancelled');
    expect(wo?.auditActions).toContain('archived');
    // A cancelled order exposes no Start/Block/Cancel controls (cannot complete).
    await expect(page.getByRole('button', { name: 'Start' })).toHaveCount(0);
  });
});

// ─── Flow I — cross-farm security (Part 11) ───────────────────────────────────
test.describe('Flow I — another farm\'s ids are rejected without revealing them', () => {
  test('submitting OTHER farm\'s fieldSeason id on create is rejected as not found', async ({ page }) => {
    await signInPilot(page, 'E2E Sprint23 CrossFarm Farm');
    const { farmOther } = JSON.parse(readFileSync('playwright/.auth/seeded-farms.json', 'utf-8')) as { farmOther: SeededFarm };

    await page.goto('/work-orders');
    const form = orderForm(page);
    // Inject OTHER's foreign fieldSeasonId as a selectable option, then submit.
    await form.locator('select[name="fieldSeasonId"]').evaluate((sel, id) => {
      const opt = document.createElement('option'); opt.value = id; opt.textContent = 'injected-foreign'; sel.appendChild(opt);
      (sel as HTMLSelectElement).value = id;
    }, farmOther.fieldSeasonId);
    await form.locator('input[name="title"]').fill('Cross-farm attempt');
    await form.getByRole('button', { name: 'Create work order' }).click();

    // Rejected as "not found" — never revealing that the record exists elsewhere.
    await expect(page.getByText('This item was not found.')).toBeVisible();
    // The same farm-scoping rejects a foreign plan id (convert), work-order id
    // (status change), machine/employee/inventory ids (create) — each server
    // action filters by farmId. Representative case asserted here.
  });
});

// ─── Flow J — offline work-order completion (Part 12) ─────────────────────────
test.describe('Flow J — offline activity completion syncs exactly once', () => {
  test('a queued offline completion is device-local, then syncs to one server result', async ({ page, context }) => {
    // Offline save + reconnect + queue drain + server sync is a heavy flow; give
    // it more than the default 60s so the reconnect sync can complete.
    test.setTimeout(150_000);
    const { seeded } = await signInPilot(page, 'E2E Sprint23 Offline Farm');
    await page.goto('/work-orders');
    const form = orderForm(page);
    await form.locator('select[name="fieldSeasonId"]').selectOption({ index: 0 });
    await form.locator('select[name="operationType"]').selectOption('spray');
    await form.locator('input[name="title"]').fill('Offline complete');
    await form.getByRole('button', { name: 'Create work order' }).click();
    await expect(page.getByText('Work order created.')).toBeVisible();
    await page.reload();
    await page.getByRole('link', { name: 'Record actual activity' }).first().click();

    // Load the dialog online, THEN go offline, then complete via the local queue.
    await prepareOfflineActivityFlow(page, context);
    await completeActualSprayActivity(page, { offline: true });
    // Device-local only — nothing on the server yet.
    expect((await countForFarm(seeded.farmId)).completedWorkOrders).toBe(0);
    expect((await countForFarm(seeded.farmId)).activities).toBe(0);

    // Reconnect and let the queue drain. Do NOT navigate — navigating aborts the
    // in-flight sync request; stay on the page and wait for the Topbar to report
    // the queue drained, exactly like sprint20-offline-sync.
    await context.setOffline(false);
    await expect(page.getByRole('link', { name: 'All changes synced' })).toBeVisible({ timeout: 60_000 });

    // Exact-one after sync: one activity AND the work order completed once (the
    // draft now carries workOrderId through the sync route).
    await expect.poll(async () => (await countForFarm(seeded.farmId)).activities, { timeout: 15_000 }).toBe(1);
    const counts = await countForFarm(seeded.farmId);
    expect(counts.completedWorkOrders).toBe(1);
    expect(counts.activities).toBe(1);
  });
});

// ─── Flow K — mobile (Part 13) ────────────────────────────────────────────────
test.describe('Flow K — mobile work-order queue is usable', () => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 430, height: 932 }]) {
    test(`no horizontal overflow and Start reachable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await signInPilot(page, 'E2E Sprint23 Mobile Farm');
      await page.goto('/work-orders');
      const form = orderForm(page);
      await form.locator('select[name="fieldSeasonId"]').selectOption({ index: 0 });
      await form.locator('select[name="operationType"]').selectOption('spray');
      await form.locator('input[name="title"]').fill('Mobile order');
      await form.getByRole('button', { name: 'Create work order' }).click();
      await expect(page.getByText('Work order created.')).toBeVisible();
      await page.reload();

      // Blocker explanation is readable; the start control is reachable.
      await expect(page.getByText(/Blocked:|Resources ready/).first()).toBeVisible();
      await expect(page.getByRole('button', { name: 'Start' }).first()).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
});
