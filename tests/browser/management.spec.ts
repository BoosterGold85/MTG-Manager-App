import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { exportCsv, fixtureRow, sol, forest, meren, tatyova } from '../importFixtures';
async function importCards(page: Page, rows = [fixtureRow(sol,2), fixtureRow(forest,3), fixtureRow(meren), fixtureRow(tatyova)]) {
 await page.getByRole('button',{name:'Import Collection',exact:true}).first().click();
 await page.locator('input[type=file]').setInputFiles({name:'ManaBox.csv',mimeType:'text/csv',buffer:Buffer.from(exportCsv(rows))});
 await page.getByRole('button',{name:'Confirm import',exact:true}).click();
 await page.getByRole('button',{name:'Return to binder'}).click();
 await expect(page.getByRole('dialog')).not.toBeVisible();
}
async function start(page:Page) { await page.goto('/'); await expect(page.locator('.card-tile')).toHaveCount(32); await importCards(page); }
async function accessibility(page:Page) {
 const dialog=page.getByRole('dialog');
 if(await dialog.isVisible()) await expect(dialog).toHaveCSS('opacity','1');
 expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
}
async function backup(page:Page) {
 const download=page.waitForEvent('download'); await page.getByRole('button',{name:'Export Backup',exact:true}).click();
 const file=await download; expect(file.suggestedFilename()).toMatch(/^mtg-manager-backup-.*\.json$/);
 const stream=await file.createReadStream(); const chunks:Buffer[]=[]; for await(const chunk of stream!) chunks.push(chunk);
 return JSON.parse(Buffer.concat(chunks).toString());
}
test('selection follows IDs through search, sorting, hidden results, clear and cancel',async({page})=>{
 await start(page); await page.getByRole('button',{name:'Select',exact:true}).click();
 await page.getByRole('button',{name:/^Select .*Sol Ring/}).click();
 await expect(page.getByRole('button',{name:/^Select .*Sol Ring/})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByRole('dialog')).not.toBeVisible();
 await page.getByRole('button',{name:/^Select .*Forest/}).click();
 await expect(page.getByText('2 selected',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:/^Select .*Forest/}).click();
 await page.getByRole('searchbox').fill('Forest'); await expect(page.getByText('1 selected',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Select all',exact:true}).click(); await expect(page.getByText('2 selected',{exact:true})).toBeVisible();
 await page.getByRole('combobox',{name:'Sort cards'}).selectOption('mana');
 await page.getByRole('button',{name:'Clear selection',exact:true}).click(); await expect(page.getByText('0 selected',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Cancel',exact:true}).click(); await expect(page.locator('.selection-bar')).not.toBeVisible();
 await page.getByRole('button',{name:'View Forest',exact:true}).click(); await expect(page.getByRole('heading',{name:'Forest',exact:true})).toBeVisible();
});
test('bulk remove confirms, preserves unrelated records, updates totals and permits deterministic re-import',async({page})=>{
 await start(page); await page.getByRole('button',{name:'Select',exact:true}).click();
 await page.getByRole('button',{name:/^Select .*Sol Ring/}).click(); await page.getByRole('button',{name:/^Select .*Forest/}).click();
 await page.getByRole('button',{name:'Remove',exact:true}).click(); await expect(page.getByText(/Your ManaBox collection and original CSV/)).toBeVisible();
 await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click(); await expect(page.locator('.card-tile')).toHaveCount(4);
 await page.getByRole('button',{name:'Remove',exact:true}).click(); await page.getByRole('button',{name:'Remove 2',exact:true}).click();
 await expect(page.locator('.card-tile')).toHaveCount(2); await expect(page.getByText('0 selected',{exact:true})).toBeVisible();
 await expect(page.locator('.collection-count')).toContainText('2 cards'); await page.reload(); await expect(page.locator('.card-tile')).toHaveCount(2);
 await importCards(page); await expect(page.locator('.card-tile')).toHaveCount(4); await expect(page.locator('.collection-count')).toContainText('7 cards');
 await importCards(page); await expect(page.locator('.collection-count')).toContainText('7 cards');
});
test('detail removal, backup, deliberate clear and empty reload',async({page},info)=>{
 await start(page); await page.getByRole('button',{name:'View Sol Ring',exact:true}).click();
 await page.getByRole('button',{name:'Remove from Collection',exact:true}).click(); await page.getByRole('button',{name:'Remove 1',exact:true}).click();
 await expect(page.locator('.card-tile')).toHaveCount(3); await page.reload(); await expect(page.locator('.card-tile')).toHaveCount(3);
 await page.getByRole('button',{name:'Manage Collection',exact:true}).click();
 await expect(page.getByText('Stored on this device',{exact:true})).toBeVisible();
 const data=await backup(page); expect(data.schemaVersion).toBe(1); expect(data.collection.items).toHaveLength(3);
 expect(data.collection.items.reduce((n:number,item:{quantityOwned:number})=>n+item.quantityOwned,0)).toBe(5);
 await page.getByRole('button',{name:'Clear Collection',exact:true}).click(); await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await expect(page.locator('.card-tile')).toHaveCount(3);
 await page.getByRole('button',{name:'Select',exact:true}).click(); await page.getByRole('button',{name:'Select all',exact:true}).click();
 await page.getByRole('button',{name:'Manage Collection',exact:true}).click(); await page.getByRole('button',{name:'Clear Collection',exact:true}).click();
 await expect(page.getByRole('button',{name:'Clear Collection',exact:true})).toBeDisabled();
 await page.getByRole('textbox',{name:'Type CLEAR to confirm'}).fill('CLEAR'); await page.getByRole('button',{name:'Clear Collection',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Your binder is waiting'})).toBeVisible(); await expect(page.locator('.selection-bar')).not.toBeVisible();
 await page.screenshot({path:info.outputPath('empty-after-clear.png')});
 await page.reload(); await expect(page.getByRole('heading',{name:'Your binder is waiting'})).toBeVisible();
 await page.screenshot({path:info.outputPath('empty-after-reload.png')});
 await page.getByRole('button',{name:'Manage Collection',exact:true}).click(); expect((await backup(page)).collection.items).toHaveLength(0);
 await expect(page.getByText('No successful import yet',{exact:false})).toBeVisible();
});
test('select all includes unrendered records and preserves hidden selections under normal and Commander filters',async({page},info)=>{
 await start(page);
 // Actual import: 327 separate binder records, same canonical printing.
 await importCards(page,Array.from({length:327},(_,i)=>fixtureRow(sol,1,{'Binder Name':`Box ${i}`})));
 await page.getByRole('button',{name:'Select',exact:true}).click(); await page.getByRole('searchbox').fill('Sol Ring');
 await expect(page.locator('.card-tile')).toHaveCount(120); await page.getByRole('button',{name:'Select all',exact:true}).click();
 await expect(page.getByText('328 selected',{exact:true})).toBeVisible();
 await page.screenshot({path:info.outputPath('large-selection.png')});
 await page.getByRole('button',{name:'Show more cards',exact:true}).click(); await expect(page.locator('.card-tile')).toHaveCount(240);
 await expect(page.locator('.card-tile[aria-pressed=true]')).toHaveCount(240);
 await page.getByRole('searchbox').fill(''); await page.getByRole('button',{name:'Green',exact:true}).click();
 await expect(page.getByText('328 selected',{exact:true})).toBeVisible(); await page.getByRole('button',{name:'Clear selection',exact:true}).click();
 await page.getByRole('button',{name:'Select all',exact:true}).click(); await expect(page.getByText('3 selected',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Clear selection',exact:true}).click();
 await page.getByRole('button',{name:'All cards',exact:true}).click(); await page.getByRole('button',{name:'Filters',exact:false}).click();
 await page.getByRole('combobox',{name:'Commander Colors'}).selectOption('BG'); await page.getByRole('button',{name:/Apply/}).click();
 await page.getByRole('button',{name:'Select all',exact:true}).click(); await expect(page.getByText('330 selected',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'All cards',exact:true}).click(); await page.getByRole('button',{name:'Select all',exact:true}).click();
 await expect(page.getByText('331 selected',{exact:true})).toBeVisible();
});
test('management states are accessible, keyboard selectable, fit viewport and capture visual evidence',async({page},info)=>{
 await start(page); await page.getByRole('button',{name:'Select',exact:true}).click();
 const tile=page.getByRole('button',{name:/^Select .*Sol Ring/}); await tile.focus(); await page.keyboard.press('Space');
 await expect(tile).toHaveAttribute('aria-pressed','true');
 await accessibility(page);
 await page.screenshot({path:info.outputPath('selection.png'),fullPage:true});
 await page.getByRole('button',{name:'Remove',exact:true}).click(); await accessibility(page);
 const cancel=page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}); await cancel.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
 await expect(page.getByRole('dialog').getByRole('button',{name:'Close dialog'})).toBeFocused();
 await page.screenshot({path:info.outputPath('remove.png')}); await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).not.toBeVisible();
 await page.getByRole('button',{name:'Manage Collection',exact:true}).click(); await accessibility(page);
 await page.screenshot({path:info.outputPath('manage.png')}); await page.getByRole('button',{name:'Clear Collection',exact:true}).click();
 await accessibility(page); await page.screenshot({path:info.outputPath('clear.png')});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('failed destructive writes preserve cards and selection and allow retry',async({page})=>{
 await start(page);
 async function failNextWrite() { await page.evaluate(()=>{
  const original=IDBObjectStore.prototype.put; let fail=true;
  IDBObjectStore.prototype.put=function(value:unknown,key?:IDBValidKey) {
   if(key==='collection' && fail) { fail=false; throw new DOMException('Simulated storage full','QuotaExceededError'); }
   return original.call(this,value,key!);
  };
 }); }
 await page.getByRole('button',{name:'Select',exact:true}).click(); await page.getByRole('button',{name:/^Select .*Sol Ring/}).click();
 await page.getByRole('button',{name:'Remove',exact:true}).click(); await failNextWrite(); await page.getByRole('button',{name:'Remove 1',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('No collection changes were saved'); await expect(page.locator('.card-tile')).toHaveCount(4);
 await expect(page.getByText('1 selected',{exact:true})).toBeVisible(); await page.getByRole('button',{name:'Remove 1',exact:true}).click();
 await expect(page.locator('.card-tile')).toHaveCount(3);
 await page.getByRole('button',{name:'Manage Collection',exact:true}).click(); await page.getByRole('button',{name:'Clear Collection',exact:true}).click();
 await page.getByRole('textbox',{name:'Type CLEAR to confirm'}).fill('CLEAR'); await failNextWrite(); await page.getByRole('button',{name:'Clear Collection',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('No collection changes were saved'); await expect(page.locator('.card-tile')).toHaveCount(3);
 await page.getByRole('button',{name:'Clear Collection',exact:true}).click(); await expect(page.getByRole('heading',{name:'Your binder is waiting'})).toBeVisible();
});
