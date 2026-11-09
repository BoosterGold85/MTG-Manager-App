import {test,expect} from '@playwright/test';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {seed,readState} from './workspaceHelpers';
import {reignOfDragonsFixture} from '../recommendationFixtures';
import {legacyFixture} from '../legacyFixture';
import {oracleCard} from '../upgradeCandidates';
const oldBuild=process.env.PRE_ANALYZER_DIST;
for(const format of ['Commander','Legacy'] as const)test(`${format}: same-origin update preserves saved records and analyzer is opt-in/read-only`,async({page})=>{
 const f=format==='Commander'?reignOfDragonsFixture():legacyFixture();
 if(oldBuild){
  expect(existsSync(resolve(oldBuild,'index.html'))).toBe(true);
  await page.route('http://127.0.0.1:4173/**',async route=>{
   const path=new URL(route.request().url()).pathname;const file=resolve(oldBuild,path==='/'?'index.html':'.'+path);
   if(!file.startsWith(resolve(oldBuild)))return route.abort();
   if(!existsSync(file))return route.fulfill({status:404,body:'Missing baseline asset'});
   const types:Record<string,string>={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.jpg':'image/jpeg','.png':'image/png'};
   await route.fulfill({body:readFileSync(file),contentType:types[extname(file)]||'application/octet-stream'});
  });
 }
 await seed(page,f.state,f.deck.name);
 if(oldBuild)await expect(page.getByRole('region',{name:'Experimental Synergy Analyzer'})).toHaveCount(0);
 await page.evaluate(()=>localStorage.setItem('analyzer-preservation-sentinel','keep my existing data'));
 const before=await readState(page),stores=await page.evaluate(async()=>({databases:await indexedDB.databases(),local:Object.fromEntries(Object.entries(localStorage))}));
 if(oldBuild)await page.unroute('http://127.0.0.1:4173/**');
 await page.reload();await expect(page.getByRole('heading',{name:f.deck.name,exact:true})).toBeVisible();
 const panel=page.getByRole('region',{name:'Experimental Synergy Analyzer',exact:true});
 await expect(panel.getByRole('button',{name:'Scan supported mechanics'})).toHaveCount(0);
 expect(await readState(page)).toEqual(before);
 await panel.getByRole('button',{name:'Open experimental analyzer'}).click();
 await panel.getByRole('button',{name:'Scan supported mechanics'}).click();
 await expect(panel.getByRole('heading',{name:'Actual analysis coverage'})).toBeVisible();
 await expect(panel).toContainText('not a complete deck analysis');
 await expect(panel).toContainText('No game-state search was attempted');
 expect(await readState(page)).toEqual(before);
 await panel.getByRole('button',{name:'Close experimental analyzer'}).click();
 await page.reload();await expect(page.getByRole('heading',{name:f.deck.name,exact:true})).toBeVisible();
 expect(await readState(page)).toEqual(before);
 expect(await page.evaluate(async()=>({databases:await indexedDB.databases(),local:Object.fromEntries(Object.entries(localStorage))}))).toEqual(stores);
});
test('targeted worker analysis presents actual named participants and proof without saving scenario state',async({page})=>{
 const f=legacyFixture();
 const witness={...oracleCard('Entry Witness','{W}',1,'Creature — Human','Whenever another creature enters, you gain 1 life.',['W']),power:'1',toughness:'1'};
 const body={...oracleCard('Plain Visitor','{1}{G}',2,'Creature — Bear','',['G']),power:'2',toughness:'2'};
 for(const c of [witness,body]){f.state.metadata[c.scryfallId]=c;f.deck.entries!.push({id:c.name,board:'main',quantity:1,name:c.name,cardIdentity:c.oracleId!,scryfallId:c.scryfallId});}
 await seed(page,f.state,f.deck.name);const before=await readState(page),panel=page.getByRole('region',{name:'Experimental Synergy Analyzer',exact:true});
 await panel.getByRole('button',{name:'Open experimental analyzer'}).click();await panel.getByText('Choose a targeted hypothetical scenario',{exact:true}).click();
 await panel.getByRole('checkbox',{name:'Entry Witness',exact:true}).check();await panel.getByRole('combobox',{name:'Starting zone for Entry Witness'}).selectOption('battlefield');
 await panel.getByRole('checkbox',{name:'Plain Visitor',exact:true}).check();await panel.getByRole('spinbutton',{name:'G mana',exact:true}).fill('1');await panel.getByRole('spinbutton',{name:'C mana',exact:true}).fill('1');
 await panel.getByRole('button',{name:'Analyze selected scenario'}).click();
 await expect(panel.getByText(/Verified within this hypothetical supported subset — path/).first()).toBeVisible();
 await panel.getByText(/Verified within this hypothetical supported subset — path/).first().click();
 await expect(panel.getByRole('heading',{name:'Mechanical proof and source evidence'}).first()).toBeVisible();
 await expect(panel).toContainText('CR608.3');await expect(panel).toContainText('Entry Witness (battlefield)');
 expect(await readState(page)).toEqual(before);
});
test('a stuck worker can be cancelled or timed out without altering storage',async({page})=>{
 test.setTimeout(30000);
 await page.route('**/assets/analyzer.worker-*.js',r=>r.fulfill({contentType:'application/javascript',body:'self.onmessage=()=>{};'}));
 const f=legacyFixture();await seed(page,f.state,f.deck.name);const before=await readState(page),panel=page.getByRole('region',{name:'Experimental Synergy Analyzer',exact:true});
 await panel.getByRole('button',{name:'Open experimental analyzer'}).click();await panel.getByRole('button',{name:'Scan supported mechanics'}).click();await panel.getByRole('button',{name:'Cancel analysis'}).click();
 await expect(panel.getByRole('alert')).toContainText('cancelled');expect(await readState(page)).toEqual(before);
 await panel.getByRole('button',{name:'Scan supported mechanics'}).click();await expect(panel.getByRole('alert')).toContainText('timed out',{timeout:12000});expect(await readState(page)).toEqual(before);
});
