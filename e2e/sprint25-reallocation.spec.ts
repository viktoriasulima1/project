import { test, expect } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';
import { resetNamedE2eUser } from './setup/reset-user-data';
import { seedReadyFarm } from './setup/seed-farms';

/**
 * Sprint 25 — reallocation UI flows. Reuses the fixed Clerk pool (PILOT),
 * creating no new users. WRITTEN BUT NOT EXECUTED this iteration: the external
 * E2E runner is gated, so no pass is claimed. Selectors target the real
 * ReallocationDialog / Finance AllocationSection built this slice; they must be
 * run and adjusted once capacity returns (Part 20).
 *
 * Flows still to add when executed: B revenue-by-yield, E stale-version (two
 * pages), F double-submit idempotency, H offline read-only, I directly-linked
 * disabled, J mobile — several need extra seeded data (a second field, an
 * activity-derived cost) or the offline harness.
 */

async function addUnallocatedExpense(page: import('@playwright/test').Page, amount: string, description: string) {
  await page.goto('/finance');
  await page.getByRole('button', { name: 'expense', exact: true }).click();
  await page.locator('input[name="description"]').fill(description);
  await page.locator('input[name="expenseDate"]').fill('2026-06-01');
  await page.locator('input[name="amount"]').fill(amount);
  await page.locator('select[name="allocationMethod"]').selectOption('unallocated');
  await page.getByRole('button', { name: 'Add expense online' }).click();
  await expect(page.getByText('Saved and included in economics.')).toBeVisible({ timeout: 10_000 });
}

test.describe('Flow A — allocate an unallocated expense to a field', () => {
  test('the record appears under Unallocated and can be allocated through the dialog', async ({ page }) => {
    const user = await resetNamedE2eUser(process.env.E2E_USER_PILOT_EMAIL!);
    await seedReadyFarm(user.id, 'E2E Sprint25 Reallocation Farm');
    await page.goto('/');
    await clerk.signIn({ page, emailAddress: user.email });

    await addUnallocatedExpense(page, '500', 'Unallocated diesel');

    // 1-4. It appears under Unallocated records; open the dialog. Scope to the
    // allocation TABLE ROW — the description also appears in the "Recent
    // financial entries" list, so an unscoped getByText matches 2 elements.
    await page.reload();
    const recordRow = page.getByRole('row', { name: /Unallocated diesel/ });
    await expect(recordRow).toBeVisible();
    await recordRow.getByRole('button', { name: 'Allocate' }).click();
    const dialog = page.getByRole('dialog', { name: /Reallocate/ });
    await expect(dialog).toBeVisible();

    // 5-7. Direct field → one field → preview.
    await dialog.getByRole('radio', { name: /Direct field/ }).check();
    await dialog.getByRole('button', { name: 'Next' }).click();
    await dialog.locator('input[name="dest"]').first().check();
    await dialog.getByRole('button', { name: 'Preview' }).click();

    // 8. Before/after impact renders from the authoritative server preview.
    await expect(dialog.getByText(/remaining unallocated/)).toBeVisible({ timeout: 10_000 });
    await dialog.getByRole('button', { name: 'Continue' }).click();

    // 9-10. Confirm and verify the success state + effective version.
    await dialog.getByRole('button', { name: 'Save reallocation' }).click();
    await expect(dialog.getByText('Reallocation saved.')).toBeVisible({ timeout: 10_000 });
    await expect(dialog.getByText(/Effective version 1/)).toBeVisible();
  });
});

test.describe('Flow D — partial allocation leaves a visible remainder', () => {
  test('allocating part of an expense keeps the rest unallocated', async ({ page }) => {
    const user = await resetNamedE2eUser(process.env.E2E_USER_PILOT_EMAIL!);
    await seedReadyFarm(user.id, 'E2E Sprint25 Partial Farm');
    await page.goto('/');
    await clerk.signIn({ page, emailAddress: user.email });

    await addUnallocatedExpense(page, '1000', 'Partial rent');
    await page.reload();
    const recordRow = page.getByRole('row', { name: /Partial rent/ });
    await recordRow.getByRole('button', { name: 'Allocate' }).click();
    const dialog = page.getByRole('dialog', { name: /Reallocate/ });
    await dialog.getByRole('radio', { name: /Selected fields/ }).check();
    await dialog.getByRole('button', { name: 'Next' }).click();
    await dialog.getByRole('checkbox', { name: /Allocate only part/ }).check();
    await dialog.locator('input[name="dest"]').first().check();
    await dialog.locator('input[type="number"]').last().fill('70');
    await dialog.getByRole('button', { name: 'Preview' }).click();
    // 70% of €1000 allocated, €300 remains unallocated.
    await expect(dialog.getByText(/remaining unallocated .*300/)).toBeVisible({ timeout: 10_000 });
  });
});
