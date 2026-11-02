import { test, expect } from '@playwright/test';
import { exportCsv, sol, fixtureRow, apiCard } from '../importFixtures';

test('same-site lookup route is available in the running app and rejects invalid requests as JSON', async ({ request }) => {
 const health=await request.get('/api/scryfall/health');
 expect(health.status()).toBe(200);
 expect(await health.json()).toMatchObject({service:'mtg-scryfall-proxy',version:'0.6.22',transport:'same-origin',maxBatch:75});
 const invalid=await request.post('/api/scryfall/cards/collection',{data:{identifiers:[]}});
 expect(invalid.status()).toBe(400);expect(await invalid.json()).toMatchObject({object:'error'});
 const unknown=await request.get('/api/scryfall/unknown');expect(unknown.status()).toBe(404);
 expect(unknown.headers()['content-type']).toContain('application/json');
});

test('multi-batch import works when direct browser access to Scryfall is unavailable', async ({ page }) => {
 const cards=Array.from({length:151},(_,i)=>({...sol,scryfallId:`33333333-0000-4000-8000-${String(i).padStart(12,'0')}`,name:`Same-site card ${i}`,setCode:'tst',collectorNumber:String(i)}));
 const byId=new Map(cards.map(c=>[c.scryfallId,c]));let direct=0,local=0;
 await page.route('https://api.scryfall.com/**',route=>{direct++;return route.abort('failed');});
 await page.route('https://cards.scryfall.io/**',route=>route.abort());
 await page.route('**/api/scryfall/cards/collection',async route=>{
  local++;const ids=route.request().postDataJSON().identifiers as {id:string}[];
  expect(ids.length).toBeLessThanOrEqual(75);
  await route.fulfill({json:{data:ids.map(({id})=>apiCard(byId.get(id)!)),not_found:[]}});
 });
 await page.goto('/');await expect(page.locator('.card-tile')).toHaveCount(32);
 await page.getByRole('button',{name:'Import Collection',exact:true}).click();
 await page.locator('input[type=file]').setInputFiles({name:'ManaBox.csv',mimeType:'text/csv',buffer:Buffer.from(exportCsv(cards.map(c=>fixtureRow(c))))});
 await expect(page.getByText('REVIEW BEFORE SAVING',{exact:true})).toBeVisible();
 await expect(page.getByText('Recognized rows',{exact:true}).locator('..').locator('dd')).toHaveText('151');
 await expect(page.getByText('Problem rows',{exact:true}).locator('..').locator('dd')).toHaveText('0');
 expect(local).toBe(3);expect(direct).toBe(0);
 await page.getByRole('button',{name:'Confirm import',exact:true}).click();
 await page.getByRole('button',{name:'Return to binder'}).click();
 await expect(page.locator('.collection-count')).toContainText('151 records');
 await page.reload();await expect(page.locator('.collection-count')).toContainText('151 records');
 expect(local).toBe(3);expect(direct).toBe(0);
});

test('assets-only deployment fails closed with an actionable message and preserves the binder', async ({ page }) => {
 await page.route('**/api/scryfall/cards/collection',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>App</title>'}));
 await page.goto('/');await expect(page.locator('.card-tile')).toHaveCount(32);
 await page.getByRole('button',{name:'Import Collection',exact:true}).click();
 const card={...sol,scryfallId:'44444444-0000-4000-8000-000000000001',name:'Needs lookup'};
 await page.locator('input[type=file]').setInputFiles({name:'ManaBox.csv',mimeType:'text/csv',buffer:Buffer.from(exportCsv([fixtureRow(card)]))});
 await expect(page.getByRole('alert')).toContainText('card lookup service is unavailable');
 await expect(page.getByRole('button',{name:'Confirm import',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Retry unresolved',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await expect(page.locator('.card-tile')).toHaveCount(32);
 await expect(page.locator('.sample-label')).toHaveText('SAMPLE COLLECTION');
});
