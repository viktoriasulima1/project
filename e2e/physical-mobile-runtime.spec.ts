import { test, expect, type Page } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';
import { resetNamedE2eUser, setE2eUserLocalePreference } from './setup/reset-user-data';
import { seedEconomicsFarm } from './setup/seed-economics';

/**
 * Physical-mobile runtime regression (Part 12 of the iPhone crash brief).
 *
 * Reproduces the physical-test flows headlessly at the two reported iPhone
 * viewports and asserts that none of them raise the RangeError
 * ("Maximum call stack size exceeded") or surface raw validation internals.
 *
 * NOTE: this does NOT perfectly reproduce Google Translate. Flow E only
 * simulates external text-node wrapping; real browser-translation testing stays
 * a manual physical gate (see docs/Physical_iPhone_Runtime_Crash_Report.md).
 */

const VIEWPORTS = [
  { name: 'iphone-390', width: 390, height: 844 },
  { name: 'iphone-430', width: 430, height: 932 },
] as const;

/** Fails the test if any uncaught client error looks like the runtime crash. */
function guardAgainstRuntimeCrash(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

function assertNoStackOverflow(errors: string[]) {
  expect(errors.filter((m) => /Maximum call stack size exceeded/i.test(m))).toEqual([]);
}

async function signIn(page: Page) {
  const user = await resetNamedE2eUser(process.env.E2E_USER_PILOT_EMAIL!);
  await seedEconomicsFarm(user.id, 'E2E Physical Mobile Farm');
  await setE2eUserLocalePreference(user.id, 'en-GB');
  await page.goto('/');
  await clerk.signIn({ page, emailAddress: user.email });
}

for (const vp of VIEWPORTS) {
  test.describe(`physical-mobile @ ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('Flow A — scouting saves with a valid condition and no raw enum error', async ({ page }) => {
      const errors = guardAgainstRuntimeCrash(page);
      await signIn(page);
      await page.goto('/scouting');
      await expect(page.getByRole('button', { name: 'Review and save visit' })).toBeVisible();
      // canonical value is submitted regardless of the visible label
      await page.getByLabel('Overall condition').selectOption('good');
      await page.getByLabel('Description').fill('Leaf spotting near the headland; cause unconfirmed.');
      await page.getByRole('button', { name: 'Review and save visit' }).click();
      await expect(page.getByText(/expected one of/i)).toHaveCount(0);
      await expect(page.getByText(/1 observation\(s\)/).first()).toBeVisible({ timeout: 30_000 });
      assertNoStackOverflow(errors);
    });

    test('Flow B — a ±5632 m fix is flagged unusable and never auto-identifies a field', async ({ page, context }) => {
      test.setTimeout(120_000);
      const errors = guardAgainstRuntimeCrash(page);
      await context.grantPermissions(['geolocation']);
      await context.setGeolocation({ latitude: 52.1, longitude: 5.2, accuracy: 5632 });
      await signIn(page);
      await page.goto('/scouting');
      await page.getByRole('button', { name: 'Use current GPS' }).click();
      await expect(page.getByText(/too low to identify a field/i)).toBeVisible();
      // low-accuracy point requires explicit confirmation before it is attached
      const confirm = page.getByRole('checkbox');
      await expect(confirm).toBeVisible();
      await expect(page.getByRole('button', { name: 'Retry location' })).toBeVisible();
      // manual field selection remains available
      await page.getByLabel('Field and crop').click();
      await page.getByLabel('Description').fill('Manual field pick after low-accuracy GPS.');
      await confirm.click({ noWaitAfter: true });
      // Confirmation removes the warning/checkbox by design once accepted.
      await expect(confirm).toHaveCount(0);
      await page.getByRole('button', { name: 'Review and save visit' }).click();
      await expect(page.getByText(/1 observation\(s\)/).first()).toBeVisible({ timeout: 30_000 });
      assertNoStackOverflow(errors);
    });

    test('Flow C — natural-language parse + mocked mic start/stop/cancel, no RangeError', async ({ page }) => {
      test.setTimeout(120_000);
      const errors = guardAgainstRuntimeCrash(page);
      // Inject a deterministic SpeechRecognition mock BEFORE app scripts load.
      await page.addInitScript(() => {
        class MockRecognition {
          continuous = false; interimResults = false; lang = 'en-US';
          onresult: ((e: unknown) => void) | null = null;
          onend: (() => void) | null = null;
          onerror: (() => void) | null = null;
          start() { setTimeout(() => { this.onresult?.({ results: [[{ transcript: 'Sprayed North Field with Amistar Opti at 2 litres per hectare over 10 hectares.' }]] }); }, 10); }
          stop() { this.onend?.(); }
          abort() { this.onend?.(); }
        }
        (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = MockRecognition;
        (window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition = MockRecognition;
      });
      await signIn(page);
      await page.goto('/dashboard');
      await page.getByRole('button', { name: /Quick log an activity/i }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByPlaceholder(/Sprayed North Field/)).toBeVisible();
      // Microphone lifecycle: start → stop → start → cancel — must stay bounded.
      await dialog.getByRole('button', { name: 'Use microphone' }).click();
      await dialog.getByRole('button', { name: /^Stop/ }).click();
      await dialog.getByRole('button', { name: 'Use microphone' }).click();
      await dialog.getByRole('button', { name: 'Cancel recording' }).click();
      await dialog.getByPlaceholder(/Sprayed North Field/).fill('Sprayed North Field with Amistar Opti at 2 litres per hectare over 10 hectares this morning using Sprayer 1.');
      await dialog.getByRole('button', { name: 'Parse into reviewed draft' }).click();
      await expect(dialog.getByRole('heading', { name: 'Structured suggestion review' })).toBeVisible({ timeout: 20_000 });
      assertNoStackOverflow(errors);
    });

    test('Flow D — repeatedly opening/closing the sidebar over the map stays responsive', async ({ page }) => {
      const errors = guardAgainstRuntimeCrash(page);
      await signIn(page);
      await page.goto('/fields/map');
      const toggle = page.getByRole('button', { name: /navigation/i });
      for (let i = 0; i < 6; i++) {
        await toggle.click();
        await page.getByRole('link', { name: 'Scouting' }).first().waitFor({ state: 'visible' });
        await toggle.click();
      }
      // the map heading remains interactive after the churn
      await expect(page.getByRole('heading', { name: /Fields · Crop health/ })).toBeVisible();
      assertNoStackOverflow(errors);
    });

    test('Flow E — simulated translated-DOM text-node wrapping does not crash a form update', async ({ page }) => {
      const errors = guardAgainstRuntimeCrash(page);
      await signIn(page);
      await page.goto('/scouting');
      await expect(page.getByLabel('Overall condition')).toBeVisible();
      // Simulate a page-translation agent wrapping visible text nodes in <font>
      // WITHOUT touching any control value (values live on option.value attrs).
      await page.evaluate(() => {
        document.documentElement.classList.add('translated-ltr');
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        const nodes: Text[] = [];
        let n = walker.nextNode();
        while (n) { if (n.textContent && n.textContent.trim()) nodes.push(n as Text); n = walker.nextNode(); }
        for (const text of nodes.slice(0, 60)) {
          const font = document.createElement('font');
          font.textContent = text.textContent;
          text.parentNode?.replaceChild(font, text);
        }
      });
      // Perform real controlled-state updates against the mutated DOM.
      await page.getByLabel('Description').fill('Observation entered while the page was translated.');
      await page.getByLabel('Overall condition').selectOption('poor');
      await expect(page.getByLabel('Overall condition')).toHaveValue('poor');
      assertNoStackOverflow(errors);
    });
  });
}
