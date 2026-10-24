import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { metadata, sol, meren, forest, tatyova, fixtureRow, exportCsv } from '../importFixtures';
import { parseManaBox } from '../../src/import/csv';
import { buildImportPlan } from '../../src/import/plan';
import { ScryfallClient } from '../../src/import/scryfall';
import { cardIdentity } from '../../src/intelligence/tagger';
import { RULESET_VERSION } from '../../src/intelligence/types';
import type { CollectionState } from '../../src/models/collection';
const hardened=Object.values(metadata).find(c=>c.name==='Hardened Scales')!;
const atraxa=Object.values(metadata).find(c=>c.name==="Atraxa, Praetors' Voice")!;
async function prepare(count=4):Promise<CollectionState> {
 const cards=[sol,meren,forest,tatyova,hardened,atraxa].slice(0,count);
 const parsed=parseManaBox(exportCsv(cards.map(c=>fixtureRow({...c,id:c.scryfallId,quantity:1}))));
 const resolved=await new ScryfallClient(undefined,0).resolve(parsed.rows,metadata,{},new AbortController().signal,()=>{});
 return buildImportPlan(parsed,resolved,null,'ManaBox.csv','2026-10-23T12:00:00Z').next;
}
async function write(page:Page,state:CollectionState) {
 await page.evaluate(state=>new Promise<void>((resolve,reject)=>{
  const open=indexedDB.open('mtg-manager-collection',1);open.onupgradeneeded=()=>open.result.createObjectStore('state');
  open.onsuccess=()=>{const db=open.result;const tx=db.transaction('state','readwrite');tx.objectStore('state').put(state,'collection');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};open.onerror=()=>reject(open.error);
 }),state);
}
async function read(page:Page):Promise<CollectionState> {
 return page.evaluate(()=>new Promise((resolve,reject)=>{const open=indexedDB.open('mtg-manager-collection',1);open.onsuccess=()=>{const db=open.result;const tx=db.transaction('state','readonly');const req=tx.objectStore('state').get('collection');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);tx.oncomplete=()=>db.close();};open.onerror=()=>reject(open.error);}));
}
async function start(page:Page,count=6) {await page.goto('/');await expect(page.locator('.card-tile')).toHaveCount(32);await write(page,await prepare(count));await page.reload();await expect(page.locator('.card-tile')).toHaveCount(count);}
async function close(page:Page) {await page.getByRole('button',{name:'Close dialog',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();}
async function filters(page:Page) {await page.getByRole('button',{name:/^Filters/}).click();return page.getByRole('dialog');}
async function apply(page:Page){await page.getByRole('button',{name:/^Apply/}).click();await expect(page.getByRole('dialog')).not.toBeVisible();}
async function importAgain(page:Page) {
 await page.getByRole('button',{name:'Import Collection',exact:true}).first().click();
 await page.locator('input[type=file]').setInputFiles({name:'ManaBox.csv',mimeType:'text/csv',buffer:Buffer.from(exportCsv([fixtureRow(sol)]))});
 await page.getByRole('button',{name:'Confirm import',exact:true}).click();await page.getByRole('button',{name:'Return to binder'}).click();await expect(page.getByRole('dialog')).not.toBeVisible();
}
test('first upgrade tags locally once, persists canonical results and skips current ruleset on reload',async({page})=>{
 await start(page);const state=await read(page);expect(Object.keys(state.intelligence!.auto)).toHaveLength(6);
 expect(state.intelligence!.auto[cardIdentity(sol)].rulesetVersion).toBe(RULESET_VERSION);
 const workers:string[]=[];page.on('worker',worker=>workers.push(worker.url()));await page.reload();await expect(page.locator('.card-tile')).toHaveCount(6);
 expect((await read(page)).revision).toBe(state.revision);expect(workers.filter(url=>url.includes('intelligence.worker'))).toHaveLength(0);
 await page.getByRole('button',{name:'View Sol Ring',exact:true}).click();await expect(page.locator('.tag-evidence').filter({hasText:'Mana Rock'})).toBeVisible();
});
test('quick tags and searchable ANY ALL filter compose with search colors types sort and Commander Colors',async({page},info)=>{
 await start(page);await page.getByRole('group',{name:'Quick synergy tags'}).getByRole('button',{name:'+1/+1 Counters',exact:true}).click();await expect(page.locator('.card-tile')).toHaveCount(1);
 let dialog=await filters(page);await dialog.getByRole('searchbox',{name:'Search tags'}).fill('prolif');await dialog.getByRole('button',{name:'Proliferate',exact:true}).click();await apply(page);await expect(page.locator('.card-tile')).toHaveCount(2);
 dialog=await filters(page);await dialog.getByRole('button',{name:'Match ALL',exact:true}).click();await page.screenshot({path:info.outputPath('tags-all.png')});await apply(page);await expect(page.getByRole('heading',{name:'No cards found'})).toBeVisible();
 await page.getByRole('button',{name:'Reset all',exact:true}).click();dialog=await filters(page);
 await dialog.getByRole('searchbox',{name:'Search tags'}).fill('graveyard');await dialog.getByRole('button',{name:'Graveyard',exact:true}).click();
 await dialog.getByRole('combobox',{name:'Commander Colors'}).selectOption('BG');await dialog.getByRole('button',{name:'Black',exact:true}).click();await dialog.getByRole('button',{name:'Creature',exact:true}).click();await apply(page);
 await page.getByRole('searchbox',{name:'Search cards by name'}).fill('meren');await page.getByRole('combobox',{name:'Sort cards'}).selectOption('mana');await expect(page.getByRole('button',{name:'View Meren of Clan Nel Toth',exact:true})).toBeVisible();await expect(page.locator('.card-tile')).toHaveCount(1);
});
test('manual add hide evidence restore survives reload re-import and explicit recalculate',async({page},info)=>{
 await start(page);await page.getByRole('button',{name:'View Sol Ring',exact:true}).click();
 const evidence=page.locator('.tag-evidence').filter({has:page.locator('summary',{hasText:'Mana Rock'})});await evidence.locator('summary').focus();await page.keyboard.press('Enter');await expect(evidence.getByText('Noncreature artifact type plus mana-production ability.')).toBeVisible();
 await page.getByRole('button',{name:'Edit Tags',exact:true}).click();await page.getByRole('searchbox',{name:'Find a tag'}).fill('tokens');await page.getByRole('button',{name:'Add manually Tokens',exact:true}).click();await expect(page.locator('.tag-edit-row').filter({hasText:'Tokens'}).getByText('Added by you',{exact:true})).toBeVisible();
 await page.getByRole('searchbox',{name:'Find a tag'}).fill('ramp');await page.getByRole('button',{name:'Hide Ramp',exact:true}).click();await expect(page.locator('.hidden-tags').getByText(/Ramp · Hidden by you/)).toBeVisible();await page.screenshot({path:info.outputPath('edited-tags.png')});await close(page);
 await page.reload();await expect(page.locator('.card-tile')).toHaveCount(6);await importAgain(page);
 let state=await read(page);expect(state.intelligence!.overrides[cardIdentity(sol)]).toMatchObject({added:['tokens'],suppressed:['ramp']});expect(state.intelligence!.overrides[cardIdentity(sol)].assignments?.map(a=>a.source)).toEqual(['manual-add','manual-remove']);
 await page.getByRole('button',{name:'Manage Collection',exact:true}).click();await page.getByRole('button',{name:'Recalculate Auto-Tags',exact:true}).click();await expect(page.getByText('Auto-tags recalculated. Your manual corrections are preserved.',{exact:true})).toBeVisible();await close(page);
 state=await read(page);expect(state.intelligence!.overrides[cardIdentity(sol)]).toMatchObject({added:['tokens'],suppressed:['ramp']});expect(state.intelligence!.auto[cardIdentity(sol)].assignments.filter(a=>a.tagId==='ramp')).toHaveLength(1);
 await page.getByRole('button',{name:'View Sol Ring',exact:true}).click();await page.getByRole('button',{name:'Edit Tags',exact:true}).click();await page.getByRole('searchbox',{name:'Find a tag'}).fill('ramp');await page.getByRole('button',{name:'Restore automatic Ramp',exact:true}).click();
 await page.getByRole('searchbox',{name:'Find a tag'}).fill('tokens');await page.getByRole('button',{name:'Restore automatic Tokens',exact:true}).click();await close(page);
 state=await read(page);expect(state.intelligence!.overrides[cardIdentity(sol)]).toMatchObject({added:[],suppressed:[]});
});
test('new imports tag before commit, re-import deduplicates and saved problems do not crash intelligence',async({page})=>{
 await page.goto('/');await expect(page.locator('.card-tile')).toHaveCount(32);await importAgain(page);
 const first=await read(page);expect(first.intelligence!.auto[cardIdentity(sol)].assignments.map(a=>a.tagId)).toContain('ramp');
 await importAgain(page);const next=await read(page);expect(next.intelligence).toEqual(first.intelligence);expect(next.items).toEqual(first.items);
 next.unresolved=[{line:2,name:'Unknown',raw:{Name:'Unknown'},message:'Not found',sourceKey:'unknown'}];await write(page,next);await page.reload();await expect(page.locator('.card-tile')).toHaveCount(1);
 await page.getByRole('button',{name:'View Sol Ring',exact:true}).click();await expect(page.getByRole('heading',{name:'Card Intelligence',exact:true})).toBeVisible();
});
test('stale ruleset recalculates automatically without removing manual corrections',async({page})=>{
 await start(page);const state=await read(page);const key=cardIdentity(sol);state.intelligence!.auto[key].rulesetVersion='old';state.intelligence!.overrides[key]={added:['tokens'],suppressed:['ramp']};await write(page,state);await page.reload();await expect(page.locator('.card-tile')).toHaveCount(6);
 const next=await read(page);expect(next.intelligence!.auto[key].rulesetVersion).toBe(RULESET_VERSION);expect(next.intelligence!.overrides[key]).toEqual(state.intelligence!.overrides[key]);expect(next.revision).toBe(state.revision+1);
});
test('large existing collection tags with canonical reuse while the main thread remains responsive',async({page},info)=>{
 await start(page,1);const state=await read(page);delete state.intelligence;
 const original=state.items[0];state.items=Array.from({length:4000},(_,i)=>({...original,id:`record-${i}`,binderName:`Box ${i}`}));await write(page,state);
 let ticks=0;await page.exposeFunction('tagHeartbeat',()=>{ticks++;});await page.addInitScript(()=>{setInterval(()=>{void (window as unknown as {tagHeartbeat:()=>Promise<void>}).tagHeartbeat();},20);});
 await page.reload();await expect(page.locator('.card-tile')).toHaveCount(120);const next=await read(page);expect(next.items).toHaveLength(4000);expect(Object.keys(next.intelligence!.auto)).toHaveLength(1);expect(ticks).toBeGreaterThan(0);
 await page.getByRole('group',{name:'Quick synergy tags'}).getByRole('button',{name:'Ramp',exact:true}).click();await expect(page.locator('.results-line')).toContainText('4000');await page.screenshot({path:info.outputPath('large-tagged-binder.png')});
});
test('tag filter evidence editing and recalculation are accessible and fit all approved viewports',async({page},info)=>{
 await start(page);const dialog=await filters(page);await expect(dialog).toHaveCSS('opacity','1');expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
 await dialog.getByRole('searchbox',{name:'Search tags'}).fill('enchantment');await page.screenshot({path:info.outputPath('tag-filter.png')});await close(page);
 await page.getByRole('button',{name:'View Sol Ring',exact:true}).click();await page.getByRole('button',{name:'Edit Tags',exact:true}).click();await page.getByRole('searchbox',{name:'Find a tag'}).fill('counter');await expect(page.getByRole('button',{name:'Close dialog',exact:true})).toBeInViewport();await expect(page.getByRole('dialog')).toHaveCSS('opacity','1');expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);await page.screenshot({path:info.outputPath('intelligence.png')});await close(page);
 await page.getByRole('button',{name:'Manage Collection',exact:true}).click();await page.getByRole('button',{name:'Recalculate Auto-Tags',exact:true}).click();await expect(page.getByText('Auto-tags recalculated. Your manual corrections are preserved.',{exact:true})).toBeVisible();await expect(page.getByRole('dialog')).toHaveCSS('opacity','1');expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);await page.screenshot({path:info.outputPath('recalculated.png')});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('failed manual save preserves original automatic state and permits retry',async({page})=>{
 await start(page);await page.getByRole('button',{name:'View Sol Ring',exact:true}).click();await page.getByRole('button',{name:'Edit Tags',exact:true}).click();await page.getByRole('searchbox',{name:'Find a tag'}).fill('ramp');
 await page.evaluate(()=>{const put=IDBObjectStore.prototype.put;let fail=true;IDBObjectStore.prototype.put=function(value:unknown,key?:IDBValidKey){if(fail&&key==='collection'){fail=false;throw new DOMException('Simulated storage full','QuotaExceededError');}return put.call(this,value,key!);};});
 await page.getByRole('button',{name:'Hide Ramp',exact:true}).click();await expect(page.getByRole('alert')).toContainText('No collection changes were saved');expect((await read(page)).intelligence!.overrides[cardIdentity(sol)]).toBeUndefined();await page.getByRole('button',{name:'Hide Ramp',exact:true}).click();await expect(page.locator('.hidden-tags').getByText(/Ramp · Hidden by you/)).toBeVisible();
});
