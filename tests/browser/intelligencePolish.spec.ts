import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import data from '../fixtures/intelligence-polish.json' with {type:'json'};
import { normalizeCard } from '../../src/import/scryfall';
import { fixtureRow, exportCsv, apiCard, sol } from '../importFixtures';
const mechanic={...apiCard(sol),id:'99999999-0000-4000-8000-000000000001',name:'Keyword Fixture',set:'tst',set_name:'Test',collector_number:'99',cmc:1,mana_cost:'{B}',color_identity:['B'],type_line:'Creature — Human',oracle_text:'Discard a card: Draw a card.',keywords:['Mayhem','Ward','Future Mechanic']};
const api=[...data,mechanic];
const cards=api.map(value=>normalizeCard(value as Parameters<typeof normalizeCard>[0]));
async function start(page:Page) {
 await page.route('https://api.scryfall.com/**',async route=>{
  const ids=route.request().postDataJSON().identifiers as {id:string}[];
  await route.fulfill({json:{data:ids.map(({id})=>api.find(c=>c.id===id)),not_found:[]}});
 });
 await page.route('https://cards.scryfall.io/**',route=>route.abort());
 await page.goto('/');await expect(page.locator('.card-tile')).toHaveCount(32);await page.getByRole('button',{name:'Import Collection',exact:true}).click();
 await page.locator('input[type=file]').setInputFiles({name:'regressions.csv',mimeType:'text/csv',buffer:Buffer.from(exportCsv(cards.map(c=>fixtureRow({...c,id:c.scryfallId,quantity:1}))))});
 await page.getByRole('button',{name:'Confirm import',exact:true}).click();await page.getByRole('button',{name:'Return to binder'}).click();await expect(page.locator('.card-tile')).toHaveCount(11);
}
async function close(page:Page) {await page.getByRole('button',{name:'Close dialog',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();}
async function apply(page:Page) {await page.getByRole('button',{name:/^Apply/}).click();await expect(page.getByRole('dialog')).not.toBeVisible();}
test('real-card regressions display corrected auto-tags across all ten named cards',async({page})=>{
 await start(page);
 const expected:[string,string[],string[]][]=[
 ['All Will Be One',['Counter Payoff'],['Enchantments Matter']],
 ['Bruenor Battlehammer',['Equipment','Voltron','Cost Reduction'],['Typal / Creature Type Matters','Eachs Matter']],
 ['Éowyn, Shieldmaiden',['Tokens','Card Draw','Humans Matter'],[]],
 ['Skullclamp',['Card Draw','Death Triggers','Equipment'],['Sacrifice Payoff']],
 ["God-Pharaoh's Gift",['Graveyard','Reanimator','Tokens'],['Graveyard Hate']],
 ['Leave // Chance',['Card Draw','Looting / Rummaging','Discard Outlet'],['Recursion']],
 ['Doubling Season',['Counter Payoff','Token Payoff'],['+1/+1 Counters']],
 ['Diregraf Colossus',['Graveyard','+1/+1 Counters','Zombies Matter','Graveyard Payoff','Tokens'],[]],
 ['Desecrated Tomb',['Graveyard Payoff','Tokens'],['Recursion']],
 ['Ghirapur Orrery',['Card Draw','Extra Land Drops','Lands Matter'],[]],
 ];
 for(const [name,positive,negative] of expected) {
  await page.getByRole('button',{name:`View ${name}`,exact:true}).click();
  const labels=await page.locator('.tag-evidence summary > span:first-child').allTextContents();
  for(const label of positive)expect(labels,`${name}: ${label}`).toContain(label);
  for(const label of negative)expect(labels,`${name}: exclude ${label}`).not.toContain(label);
  await close(page);
 }
});
test('canonical Keywords are searchable selectable and separate from Tags with combined Commander filtering',async({page},info)=>{
 await start(page);await page.getByRole('button',{name:/^Filters/}).click();let dialog=page.getByRole('dialog');
 await dialog.getByRole('searchbox',{name:'Search keywords'}).fill('mayh');await dialog.getByRole('button',{name:'Mayhem',exact:true}).click();
 await expect(dialog.getByRole('button',{name:'Mayhem',exact:true})).toHaveAttribute('aria-pressed','true');
 await dialog.getByRole('searchbox',{name:'Search tags'}).fill('graveyard');await dialog.getByRole('button',{name:'Graveyard',exact:true}).click();
 await dialog.getByRole('combobox',{name:'Commander Colors'}).selectOption('BG');await page.screenshot({path:info.outputPath('keywords.png')});await apply(page);
 await expect(page.locator('.card-tile')).toHaveCount(1);await page.getByRole('button',{name:'View Keyword Fixture',exact:true}).click();
 await expect(page.locator('.canonical-keywords')).toContainText('Mayhem');await expect(page.locator('.canonical-keywords')).toContainText('Future Mechanic');
 expect(await page.locator('.tag-evidence summary > span:first-child').allTextContents()).not.toContain('Mayhem');await close(page);
 await page.getByRole('button',{name:/^Filters/}).click();dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Clear keywords',exact:true}).click();await apply(page);
 await page.getByRole('button',{name:'Reset all',exact:true}).click();await expect(page.locator('.card-tile')).toHaveCount(11);
});
test('optional Name Oracle Text All search includes split-card halves and preserves default name behavior',async({page})=>{
 await start(page);await page.getByRole('searchbox',{name:'Search cards by name'}).fill('additional land');await expect(page.getByRole('heading',{name:'No cards found'})).toBeVisible();
 await page.getByRole('combobox',{name:'Search in'}).selectOption('oracle');await expect(page.getByRole('button',{name:'View Ghirapur Orrery',exact:true})).toBeVisible();await expect(page.locator('.card-tile')).toHaveCount(1);
 await page.getByRole('searchbox',{name:'Search Oracle text'}).fill('discard any number');await expect(page.getByRole('button',{name:'View Leave // Chance',exact:true})).toBeVisible();
 await page.getByRole('combobox',{name:'Search in'}).selectOption('all');await page.getByRole('searchbox',{name:'Search card name and Oracle text'}).fill('Bruenor');await expect(page.getByRole('button',{name:'View Bruenor Battlehammer',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Reset all',exact:true}).click();await expect(page.getByRole('combobox',{name:'Search in'})).toHaveValue('name');await expect(page.locator('.card-tile')).toHaveCount(11);
});
test('keyword controls text search and corrected evidence remain accessible and fit approved sizes',async({page},info)=>{
 await start(page);expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
 await page.screenshot({path:info.outputPath('binder-search.png')});await page.getByRole('button',{name:/^Filters/}).click();await expect(page.getByRole('dialog')).toHaveCSS('opacity','1');
 await page.getByRole('searchbox',{name:'Search keywords'}).fill('future');await page.getByRole('button',{name:'Future Mechanic',exact:true}).focus();await page.keyboard.press('Space');await expect(page.getByRole('button',{name:'Future Mechanic',exact:true})).toHaveAttribute('aria-pressed','true');
 expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);await page.screenshot({path:info.outputPath('keyword-filter.png')});await close(page);
 await page.getByRole('button',{name:'View Leave // Chance',exact:true}).click();await page.locator('.intelligence').scrollIntoViewIfNeeded();await page.locator('.tag-evidence').filter({hasText:'Discard Outlet'}).locator('summary').click();
 await expect(page.locator('.tag-evidence[open]')).toContainText('Chance');expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);await page.screenshot({path:info.outputPath('split-evidence.png')});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
