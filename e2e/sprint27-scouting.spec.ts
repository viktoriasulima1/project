import { test, expect } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';
import { resetNamedE2eUser } from './setup/reset-user-data';
import { seedEconomicsFarm } from './setup/seed-economics';
import { PrismaClient } from '@prisma/client';

async function signIn(page: import('@playwright/test').Page) {
  const user=await resetNamedE2eUser(process.env.E2E_USER_PILOT_EMAIL!);
  const fixture=await seedEconomicsFarm(user.id,'E2E Sprint27 Scouting Farm');
  await page.goto('/'); await clerk.signIn({page,emailAddress:user.email}); return fixture;
}

test('Flow A — records a stage and two unconfirmed observations', async ({page}) => {
  await signIn(page); await page.goto('/scouting');
  await expect(page.getByRole('heading',{name:'Field scouting'})).toBeVisible();
  await page.getByLabel('BBCH code').fill('32'); await page.getByLabel('Human-readable label').fill('Stem elongation');
  await page.getByLabel('Description').fill('Brown spots on lower leaves; cause not confirmed.');
  await page.getByRole('button',{name:'+ Add observation'}).click();
  await page.getByLabel('Observed issue').nth(1).fill('Unknown weed patch'); await page.getByLabel('Description').nth(1).fill('Patch at the northern edge.');
  await page.getByRole('button',{name:'Review and save visit'}).click();
  await expect(page.getByText(/2 observation\(s\)/).first()).toBeVisible();
  await expect(page.getByText(/Brown spots on lower leaves/)).toBeVisible();
});

test('Flow D — field map and detail use shared health labels', async ({page}) => {
  await signIn(page); await page.goto('/fields/map'); await expect(page.getByRole('heading',{name:/Fields · Crop health/})).toBeVisible();
  await expect(page.getByText(/Insufficient data/).first()).toBeVisible();
});

test('Flow J — scouting form has no mobile horizontal overflow', async ({page}) => {
  await page.setViewportSize({width:390,height:844}); await signIn(page); await page.goto('/scouting');
  await expect(page.getByRole('button',{name:'Review and save visit'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test('Flow K — real photo annotations persist and finalized corrections retain versions', async ({page}) => {
  await signIn(page); await page.goto('/scouting');
  const marker=`Annotation persistence ${Date.now()}`;
  await page.getByLabel('Description').fill(marker);
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
  await page.getByLabel('Photos for observation 1').setInputFiles({name:'synthetic-leaf.png',mimeType:'image/png',buffer:png});
  await page.getByRole('button',{name:'Review and save visit'}).click();
  await page.waitForURL(/\/scouting\?visit=/,{timeout:30_000});await expect(page.getByText(marker)).toBeVisible();
  const prisma=new PrismaClient({datasources:{db:{url:process.env.E2E_DATABASE_URL}}});
  const photo=await prisma.scoutingPhoto.findFirst({where:{observation:{description:marker}},orderBy:{createdAt:'desc'}});await prisma.$disconnect();expect(photo).not.toBeNull();
  await page.goto(`/scouting/photos/${photo!.id}`);await page.getByRole('button',{name:'Edit annotations'}).click();
  await page.getByLabel('Correction reason').fill('Mark visible affected area');
  await page.getByRole('button',{name:'rectangle',exact:true}).click();
  const canvas=page.getByAltText('Photo being annotated').locator('..');await canvas.scrollIntoViewIfNeeded();
  await canvas.evaluate(element=>{const box=element.getBoundingClientRect();element.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:1,clientX:box.left+box.width*.1,clientY:box.top+box.height*.1}));element.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:1,clientX:box.left+box.width*.3,clientY:box.top+box.height*.3}))});
  page.once('dialog',dialog=>dialog.accept('Brown leaf area'));await page.getByRole('button',{name:'text',exact:true}).click();await canvas.evaluate(element=>{const box=element.getBoundingClientRect();element.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:2,clientX:box.left+box.width*.2,clientY:box.top+box.height*.2}));element.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:2,clientX:box.left+box.width*.2,clientY:box.top+box.height*.2}))});
  await expect(page.getByLabel('rectangle: Area')).toBeVisible();await expect(page.getByLabel('text: Brown leaf area')).toBeVisible();
  await page.getByRole('button',{name:'Save annotations'}).click();await expect(page.getByText('Synchronized. Annotation version saved.')).toBeVisible();
  await page.reload();await expect(page.getByText(/rectangle: Area/)).toBeVisible();await expect(page.getByText(/text: Brown leaf area/)).toBeVisible();await expect(page.getByText(/Original and corrected versions \(2\)/)).toBeVisible();
  await page.getByRole('button',{name:'Edit annotations'}).click();await page.getByLabel('Correction reason').fill('Corrected after review');await page.getByRole('button',{name:'Save annotations'}).click();await expect(page.getByText('Synchronized. Annotation version saved.')).toBeVisible();await page.reload();await page.getByText(/Original and corrected versions \(3\)/).click();await expect(page.getByText(/Version 3 — Current effective — Corrected after review/)).toBeVisible();
  await page.getByLabel('I explicitly consent to process this selected photo context').check();await page.getByRole('button',{name:'Confirm and request'}).click();await expect(page.getByRole('heading',{name:/Possible explanations/})).toBeVisible();await expect(page.getByText(/No pesticide or treatment recommendation/)).toBeVisible();await page.getByRole('button',{name:'Save as suspected issue'}).click();await expect(page.getByText('Review saved. No diagnosis or treatment was confirmed.')).toBeVisible();await page.getByRole('button',{name:'Create agronomist consultation Work Order'}).click();await expect(page.getByText('Consultation Work Order created. No treatment was authorized.')).toBeVisible();
  const reviewDb=new PrismaClient({datasources:{db:{url:process.env.E2E_DATABASE_URL}}});const reviewed=await reviewDb.scoutingPhoto.findUnique({where:{id:photo!.id},include:{suggestions:true,observation:true}});await reviewDb.$disconnect();expect(reviewed?.suggestions[0].farmerAction).toBe('consultation');expect(reviewed?.observation.certainty).toBe('suspected_cause');expect(reviewed?.observation.followUpWorkOrderId).toBeTruthy();
});

test('Flow L — Sync Center retries only the selected failed photo with the same idempotency key', async ({page,context}) => {
  await signIn(page);await page.goto('/scouting');const marker=`Direct retry ${Date.now()}`;await page.getByLabel('Description').fill(marker);
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');await page.getByLabel('Photos for observation 1').setInputFiles({name:'retry-leaf.png',mimeType:'image/png',buffer:png});
  await context.setOffline(true);await page.getByRole('button',{name:'Review and save visit'}).click();await expect(page.getByText(/Saved locally/)).toBeVisible();await context.setOffline(false);
  let attempts=0;await page.route('**/api/scouting/photos',async route=>{attempts++;if(attempts===1)await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Forced transient provider outage'})});else await route.continue()});
  await page.goto('/offline');await expect(page.getByText('retry-leaf.png')).toBeVisible();await page.getByRole('button',{name:'Review local annotations'}).click();await page.getByRole('button',{name:'rectangle',exact:true}).click();const localCanvas=page.getByAltText('Photo being annotated').locator('..');await localCanvas.evaluate(element=>{const box=element.getBoundingClientRect();element.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:4,clientX:box.left+box.width*.1,clientY:box.top+box.height*.1}));element.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:4,clientX:box.left+box.width*.4,clientY:box.top+box.height*.4}))});await page.getByRole('button',{name:'Save annotations'}).click();await expect(page.getByText('Saved locally on this device. No server synchronization is claimed.')).toBeVisible();await page.reload();await expect(page.getByText(/1 local annotation\(s\)/)).toBeVisible();await page.getByRole('button',{name:'Retry this item'}).click();await expect(page.getByText('Forced transient provider outage').first()).toBeVisible();await expect(page.getByText(/Retry count: 1/)).toBeVisible();
  await page.getByRole('button',{name:'Retry this item'}).click();await expect(page.getByRole('status').filter({hasText:/Photo synchronized/})).toBeVisible();await expect(page.getByText(/Retry count: 2/)).toBeVisible();expect(attempts).toBe(2);
  const prisma=new PrismaClient({datasources:{db:{url:process.env.E2E_DATABASE_URL}}});const observation=await prisma.scoutingObservation.findFirst({where:{description:marker},include:{photos:{include:{annotationVersions:true}}}});await prisma.$disconnect();expect(observation?.photos).toHaveLength(1);expect(observation?.photos[0].uploadStatus).toBe('finalized');expect(observation?.photos[0].annotationVersions).toHaveLength(1);expect(observation?.photos[0].annotationVersions[0].annotationsJson).toHaveLength(1);
});
