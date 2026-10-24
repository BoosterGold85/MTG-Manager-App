import { test, expect } from '@playwright/test';
import { exportCsv, sol, fixtureRow, apiCard } from '../importFixtures';
const cards=Array.from({length:76},(_,i)=>({...sol,scryfallId:`11111111-0000-4000-8000-${String(i).padStart(12,'0')}`,name:`Lookup ${i}`,setCode:'tst',collectorNumber:String(i)}));
test('interrupted preview retries only remaining printings, commits safely, and caches lookups across reload',async({page})=>{
 test.setTimeout(60000);
 const succeeded=new Set<string>();let outage=true,failures=0,requests=0;
 await page.route('https://api.scryfall.com/**',async route=>{
  requests++;const ids=route.request().postDataJSON().identifiers as {id:string}[];
  if(ids[0].id===cards[75].scryfallId && outage) {failures++;await route.fulfill({status:503,json:{object:'error',details:'Temporary outage'}});return;}
  for(const {id} of ids) {expect(succeeded.has(id)).toBe(false);succeeded.add(id);}
  await route.fulfill({json:{data:ids.map(({id})=>apiCard(cards.find(c=>c.scryfallId===id)!)),not_found:[]}});
 });
 await page.route('https://cards.scryfall.io/**',route=>route.abort());
 await page.goto('/');await expect(page.locator('.card-tile')).toHaveCount(32);await page.getByRole('button',{name:'Import Collection',exact:true}).click();
 await page.locator('input[type=file]').setInputFiles({name:'ManaBox.csv',mimeType:'text/csv',buffer:Buffer.from(exportCsv(cards.map(c=>fixtureRow(c))))});
 await expect(page.getByRole('alert')).toContainText('interrupted after 75 of 76 rows',{timeout:20000});
 await expect(page.getByRole('button',{name:'Confirm import',exact:true})).toHaveCount(0);await expect(page.getByText('Problem rows',{exact:true})).toHaveCount(0);
 await expect(page.locator('.sample-label')).toHaveText('SAMPLE COLLECTION');expect(failures).toBe(4);expect(succeeded.size).toBe(75);
 outage=false;await page.getByRole('button',{name:'Retry unresolved',exact:true}).click();
 await expect(page.getByText('REVIEW BEFORE SAVING',{exact:true})).toBeVisible({timeout:20000});expect(requests).toBe(6);
 await expect(page.getByText('Problem rows',{exact:true}).locator('..').locator('dd')).toHaveText('0');
 await page.getByRole('button',{name:'Confirm import',exact:true}).click();await page.getByRole('button',{name:'Return to binder'}).click();await expect(page.locator('.card-tile')).toHaveCount(76);
 await page.reload();await expect(page.locator('.card-tile')).toHaveCount(76);const before=requests;
 await page.getByRole('button',{name:'Import Collection',exact:true}).click();await page.locator('input[type=file]').setInputFiles({name:'ManaBox.csv',mimeType:'text/csv',buffer:Buffer.from(exportCsv(cards.map(c=>fixtureRow(c))))});
 await expect(page.getByText('REVIEW BEFORE SAVING',{exact:true})).toBeVisible();expect(requests).toBe(before);
 await expect(page.getByText('Unchanged records',{exact:true}).locator('..').locator('dd')).toHaveText('76');
});
