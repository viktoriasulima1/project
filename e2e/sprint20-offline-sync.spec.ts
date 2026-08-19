import { test, expect } from '@playwright/test';

test.use({ storageState: 'playwright/.auth/userReady.json' });

test('offline scouting draft survives locally and synchronizes once after reconnection', async ({ page, context }) => {
  await page.goto('/activities');
  await page.getByRole('button', { name: '+ Record activity' }).click();
  await page.getByRole('button', { name: 'Scouting' }).click();
  await page.locator('#fieldSeasonId').selectOption({ index: 1 });
  await page.locator('#areaHa').fill('1.25');
  await expect(page.getByText('Saved on this device')).toBeVisible();

  await context.setOffline(true);
  await page.getByRole('button', { name: 'Save activity' }).click();
  await expect(page.getByText('Activity saved on this device')).toBeVisible();
  await expect(page.getByText(/Waiting to sync/)).toBeVisible();

  const localDrafts = await page.evaluate(async () => {
    const request = indexedDB.open('farmos-offline');
    const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess=()=>resolve(request.result); request.onerror=()=>reject(request.error); });
    const tx = db.transaction('drafts','readonly');
    const all = tx.objectStore('drafts').getAll();
    return await new Promise<unknown[]>((resolve,reject)=>{ all.onsuccess=()=>resolve(all.result); all.onerror=()=>reject(all.error); });
  });
  expect(localDrafts).toHaveLength(1);

  await context.setOffline(false);
  await expect(page.getByRole('link', { name: 'All changes synced' })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'View activity history' }).click();
  await expect(page).toHaveURL(/\/activities/);
});

test('service worker and manifest are available without caching API responses', async ({ page }) => {
  await page.goto('/dashboard');
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker?.controller || navigator.serviceWorker?.ready))).toBeTruthy();
  const manifest = await page.request.get('/manifest.webmanifest');
  expect(manifest.ok()).toBeTruthy();
  const sw = await (await page.request.get('/sw.js')).text();
  expect(sw).toContain("request.method !== 'GET'");
  expect(sw).toContain("url.pathname.startsWith('/_next/static/')");
  expect(sw).not.toContain("caches.put('/api/");
});
