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

test('4,421-row CSV upload survives a transient batch and one malformed printing, then repairs only that row on re-import', async ({ page }) => {
 test.setTimeout(120000);
 const large=Array.from({length:4421},(_,i)=>({...sol,scryfallId:`22222222-0000-4000-8000-${String(i).padStart(12,'0')}`,name:`Reliability Card ${String(i).padStart(5,'0')}`,setCode:'big',collectorNumber:String(i+1)}));
 const byId=new Map(large.map(c=>[c.scryfallId,c]));
 const brokenId=large[2000].scryfallId;
 let transient=true,malformed=true,requests=0;
 const successes=new Map<string,number>();
 await page.route('https://api.scryfall.com/**',async route=>{
  requests++;
  const ids=route.request().postDataJSON().identifiers as {id:string}[];
  if(transient && ids.some(i=>i.id===large[1800].scryfallId)) {
   transient=false;
   await route.fulfill({status:503,json:{object:'error',details:'Temporary service outage'}});return;
  }
  const data=ids.map(({id})=>{
   successes.set(id,(successes.get(id)||0)+1);
   const card=apiCard(byId.get(id)!);
   return id===brokenId&&malformed?{...card,color_identity:undefined}:card;
  });
  await route.fulfill({json:{data,not_found:[]}});
 });
 const file={name:'ManaBox-4421.csv',mimeType:'text/csv',buffer:Buffer.from(exportCsv(large.map(c=>fixtureRow(c))))};
 const stat=(label:string)=>page.getByText(label,{exact:true}).locator('..').locator('dd');
 const upload=async()=>{
  await page.getByRole('button',{name:'Import Collection',exact:true}).first().click();
  await page.locator('input[type=file]').setInputFiles(file);
  await expect(page.getByText('REVIEW BEFORE SAVING',{exact:true})).toBeVisible({timeout:60000});
 };
 const commit=async()=>{
  await page.getByRole('button',{name:'Confirm import',exact:true}).click();
  await page.getByRole('button',{name:'Return to binder'}).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
 };
 await page.goto('/');await expect(page.locator('.card-tile')).toHaveCount(32);
 await upload();
 await expect(stat('Recognized rows')).toHaveText('4,420');
 await expect(stat('Problem rows')).toHaveText('1');
 await expect(page.getByRole('button',{name:'Retry unresolved',exact:true})).toHaveCount(0);
 expect(requests).toBe(60); // 59 sequential successful batches, plus one 503 retry.
 expect([...successes.values()].every(n=>n===1)).toBe(true);
 await commit();
 await expect(page.locator('.collection-count')).toContainText('4420 records');
 await page.reload();await expect(page.locator('.card-tile')).toHaveCount(120);
 malformed=false;const beforeRepair=requests;
 await upload();expect(requests).toBe(beforeRepair+1);
 await expect(stat('Recognized rows')).toHaveText('4,421');
 await expect(stat('Unchanged records')).toHaveText('4,420');
 await expect(stat('New records')).toHaveText('1');
 await expect(stat('Problem rows')).toHaveText('0');
 expect(successes.get(brokenId)).toBe(2);
 expect([...successes.entries()].filter(([id])=>id!==brokenId).every(([,n])=>n===1)).toBe(true);
 await commit();await expect(page.locator('.collection-count')).toContainText('4421 records');
 const beforeRepeat=requests;await upload();expect(requests).toBe(beforeRepeat);
 await expect(stat('Unchanged records')).toHaveText('4,421');
 await expect(stat('Problem rows')).toHaveText('0');
});
