import {constructedCandidates} from '../../src/standard/engine';
import {canonicalInput} from '../../src/upgrades/inputs';
import {synergyFor,brewFor} from '../../src/upgrades';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import type {Page} from '@playwright/test';
import {test,expect} from '@playwright/test';
import {seed,section} from './workspaceHelpers';
import {allStorage,addStorageSentinels} from './analyzerStorage';
import {reignOfDragonsFixture} from '../recommendationFixtures';
import {legacyFixture} from '../legacyFixture';
import {oracleCard} from '../upgradeCandidates';
for(const format of ['Commander','Legacy'])test(`${format}: Brew Lab compares same card and closes with all storage intact`,async({page,baseURL})=>{
 const f=format==='Commander'?reignOfDragonsFixture():legacyFixture();
 const body={...oracleCard('Lab Visitor','{1}',1,'Creature — Bear','',[]),power:'2',toughness:'2'};
 const witness={...oracleCard('Lab Observer','{W}',1,'Creature — Human','Whenever another creature enters, you gain 1 life.',['W']),power:'1',toughness:'1'};
 for(const c of [body,witness]){f.state.metadata[c.scryfallId]=c;f.deck.entries!.push({id:c.name,board:'main',quantity:1,name:c.name,cardIdentity:c.oracleId!,scryfallId:c.scryfallId});}
 const origin=baseURL!;await baseline(page,origin);
 await seed(page,f.state,f.deck.name,'Upgrades');await addStorageSentinels(page);const before=await allStorage(page);await page.unroute(origin+'/**');await page.reload();await section(page,'Upgrades');
 const lab=page.getByRole('region',{name:'Experimental Brew Lab',exact:true});
 await lab.getByRole('button',{name:'Open Brew Lab',exact:true}).click();
 if(format==='Legacy'){const candidate=(f as ReturnType<typeof legacyFixture>).candidate;const expected=constructedCandidates(f.state,f.deck).candidates.find(c=>c.card.scryfallId===candidate.scryfallId);expect(expected).toBeDefined();await lab.getByRole('combobox',{name:'Brew Lab card'}).selectOption(candidate.scryfallId);await expect(lab).toContainText(`Original Plan Fit ${expected!.score} · Original Brew Score ${expected!.brew}`);}
 const input=canonicalInput(f.state,body),sample={...body,id:body.scryfallId,quantity:1};
 await lab.getByRole('combobox',{name:'Brew Lab card',exact:true}).selectOption(body.scryfallId);
 if(format==='Commander')await expect(lab).toContainText(`Original Plan Fit ${synergyFor(f.state,f.deck,sample).score} · Original Brew Score ${brewFor(f.state,f.deck,sample,input.identity).score}`);
 await expect(lab).toContainText('Lab Visitor · same-card comparison');
 await expect(lab).toContainText(format==='Commander'?'Original Brew Score':'original engine has no eligible scored comparison');
 await lab.getByText('Choose a targeted hypothetical scenario',{exact:true}).click();
 await lab.getByRole('checkbox',{name:'Lab Observer',exact:true}).check();
 await lab.getByRole('combobox',{name:'Starting zone for Lab Observer'}).selectOption('battlefield');
 await lab.getByRole('spinbutton',{name:'C mana',exact:true}).fill('1');
 await lab.getByRole('button',{name:'Analyze selected scenario'}).click();
 const proof=lab.getByText(/Provisional mechanical evidence within this hypothetical supported subset — path/).first();await expect(proof).toBeVisible();await proof.click();
 await expect(lab).toContainText('Lab Observer (battlefield)');await expect(lab).toContainText('Costs paid');await expect(lab).toContainText('net life: 1');
 await lab.getByText('Counterfactual participant removal',{exact:true}).click();await lab.getByRole('button',{name:'Preview removal of Lab Observer',exact:true}).click();
 await expect(lab).toContainText('0 paths remain after removal');
 await lab.getByRole('combobox',{name:'Brew Lab remove card'}).selectOption(witness.scryfallId);
 await lab.getByText('Choose a targeted hypothetical scenario',{exact:true}).click();await expect(lab.getByRole('checkbox',{name:'Lab Observer',exact:true})).toHaveCount(0);
 await lab.getByRole('button',{name:'Analyze selected scenario'}).click();await expect(lab).toContainText('No supported interaction chain was discovered');
 await lab.getByRole('button',{name:'Close Brew Lab',exact:true}).click();await expect(lab.getByRole('combobox',{name:'Brew Lab card'})).toHaveCount(0);
 await section(page,'Overview');await section(page,'Upgrades');expect(await allStorage(page)).toEqual(before);
 await baseline(page,origin);await page.reload();expect(await allStorage(page)).toEqual(before);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

async function baseline(page:Page,origin:string){
 const root=process.env.PRE_ANALYZER_DIST;if(!root)throw new Error('PRE_ANALYZER_DIST is required for update/rollback evidence.');
 await page.route(origin+'/**',async route=>{const path=new URL(route.request().url()).pathname,file=resolve(root,path==='/'?'index.html':'.'+path);if(!file.startsWith(resolve(root))||!existsSync(file))return route.fulfill({status:404,body:'Missing baseline asset'});const types:Record<string,string>={'.html':'text/html','.js':'application/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml','.json':'application/json'};await route.fulfill({body:readFileSync(file),contentType:types[extname(file)]||'application/octet-stream'});});
}

test('closing, cancelling and timing out a worker leaves all storage intact',async({page})=>{
 test.setTimeout(30000);const f=legacyFixture();await seed(page,f.state,f.deck.name,'Upgrades');await addStorageSentinels(page);const before=await allStorage(page);
 await page.route(/(?:assets\/analyzer\.worker-[^/]+\.js|src\/experimental\/universal\/analyzer\.worker\.ts)/,r=>r.fulfill({contentType:'application/javascript',body:'self.onmessage=()=>{};'}));
 const lab=page.getByRole('region',{name:'Experimental Brew Lab',exact:true});await lab.getByRole('button',{name:'Open Brew Lab',exact:true}).click();await lab.getByRole('combobox',{name:'Brew Lab card'}).selectOption(f.candidate.scryfallId);
 await lab.getByRole('button',{name:'Analyze selected scenario'}).click();await lab.getByRole('button',{name:'Cancel analysis'}).click();await expect(lab.getByRole('alert')).toContainText('cancelled');
 await lab.getByRole('button',{name:'Analyze selected scenario'}).click();await expect(lab.getByRole('alert')).toContainText('timed out',{timeout:12000});
 await lab.getByRole('button',{name:'Analyze selected scenario'}).click();await lab.getByRole('button',{name:'Close Brew Lab',exact:true}).click();await lab.getByRole('button',{name:'Open Brew Lab',exact:true}).click();await expect(lab.getByRole('alert')).toHaveCount(0);expect(await allStorage(page)).toEqual(before);
});
