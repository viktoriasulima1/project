import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';
import { resetNamedE2eUser, setE2eUserLocalePreference } from './setup/reset-user-data';
import { seedReadyFarm } from './setup/seed-farms';
import { setAnonymousLocaleCookie } from './setup/locale-helpers';
import { loadTestMessages } from './setup/test-messages';

type Locale = 'nl-NL' | 'en-GB' | 'pl-PL' | 'de-DE';

async function setup(page: Page, context: BrowserContext, baseURL: string | undefined, locale: Locale) {
  const user = await resetNamedE2eUser(process.env.E2E_USER_PILOT_EMAIL!);
  await seedReadyFarm(user.id, `E2E Stage 18 ${locale}`);
  await page.goto('/');
  await clerk.signIn({ page, emailAddress: user.email });
  await setE2eUserLocalePreference(user.id, locale);
  await setAnonymousLocaleCookie(context, baseURL, locale);
  await page.goto('/offline');
}

async function localDraftCount(page: Page) {
  return page.evaluate(async () => {
    if ('databases' in indexedDB) {
      const databases = await indexedDB.databases();
      if (!databases.some((database) => database.name === 'farmos-offline')) return 0;
    }
    const request = indexedDB.open('farmos-offline');
    const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess=()=>resolve(request.result); request.onerror=()=>reject(request.error); });
    if (!db.objectStoreNames.contains('drafts')) { db.close(); return 0; }
    const tx = db.transaction('drafts','readonly');
    const count = tx.objectStore('drafts').count();
    const value = await new Promise<number>((resolve,reject)=>{count.onsuccess=()=>resolve(count.result);count.onerror=()=>reject(count.error);});
    db.close(); return value;
  });
}

test.describe('Stage 18 — Offline Sync Center user errors', () => {
  test.describe.configure({ mode: 'serial' });

  test('real offline APIs return canonical safe 400/403 contracts', async ({ page, context, baseURL }) => {
    await setup(page, context, baseURL, 'en-GB');
    const denied = await page.request.post('/api/offline/sync', { headers: { origin: 'https://evil.example' }, data: {} });
    expect(denied.status()).toBe(403);
    const deniedBody = await denied.json();
    expect(deniedBody).toMatchObject({ ok:false,error:{code:'REQUEST_NOT_ALLOWED',category:'authorization',retryable:false} });
    const missing = await page.request.post('/api/offline/sync', { data: {} });
    expect(missing.status()).toBe(400);
    const missingBody = await missing.json();
    expect(missingBody).toMatchObject({ ok:false,error:{code:'REQUIRED_FIELD',category:'validation',retryable:false,field:'formData'} });
    const finance = await page.request.post('/api/offline/finance-sync', { data: {} });
    expect(finance.status()).toBe(400);
    const financeBody = await finance.json();
    expect(financeBody).toMatchObject({ ok:false,error:{code:'INVALID_VALUE',category:'validation',retryable:false,field:'formData'} });
    expect(JSON.stringify([deniedBody,missingBody,financeBody])).not.toMatch(/DOMException|object store|stack|cookie|token|evil\.example/i);
  });

  for (const locale of ['nl-NL','en-GB','pl-PL','de-DE'] as const) {
    test(`${locale}: invalid recovery JSON is localized, atomic and contains no parser detail`, async ({ page, context, baseURL }) => {
      await setup(page, context, baseURL, locale);
      const before = await localDraftCount(page);
      await page.locator('input[type=file]').setInputFiles({ name:'broken-recovery.json', mimeType:'application/json', buffer:Buffer.from('{not-json') });
      await expect(page.locator('#recovery-import-error')).toHaveText(loadTestMessages(locale).errors.INVALID_VALUE);
      expect(await localDraftCount(page)).toBe(before);
      await expect(page.getByText(/Unexpected token|JSON\.parse|DOMException|object store|INVALID_VALUE/i)).toHaveCount(0);
    });
  }

  for (const sample of [{ locale:'de-DE' as const, width:390,height:844 },{ locale:'pl-PL' as const,width:430,height:932 }]) {
    test(`${sample.locale} ${sample.width}×${sample.height}: recovery error is accessible without overflow`, async ({ page, context, baseURL }) => {
      await page.setViewportSize({width:sample.width,height:sample.height});
      await setup(page, context, baseURL, sample.locale);
      await page.locator('input[type=file]').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{')});
      await expect(page.locator('#recovery-import-error')).toHaveText(loadTestMessages(sample.locale).errors.INVALID_VALUE);
      await expect(page.getByRole('button',{name:'Retry waiting items'})).toBeVisible();
      await expect(page.getByRole('button',{name:'Export all local drafts'})).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    });
  }
});
