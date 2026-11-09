import {test,expect} from '@playwright/test';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {seed} from './workspaceHelpers';
import {allStorage,addStorageSentinels} from './analyzerStorage';
import {legacyFixture} from '../legacyFixture';
import type {AnalyzerRequest} from '../../src/experimental/universal/protocol';
const harness=process.env.ANALYZER_TEST_HARNESS==='1'&&!process.env.TEST_PRODUCTION;
test('thirty complete public decks use bounded real workers without writes',async({page,browser})=>{
 test.skip(!harness,'Runs only in the local QA harness.');test.setTimeout(120000);
 const f=legacyFixture();await seed(page,f.state,f.deck.name);await addStorageSentinels(page);const before=await allStorage(page);
 const decks=JSON.parse(readFileSync('research/browser-adapter/public-decks.json','utf8')) as {id:string;name:string;format:string;cards:AnalyzerRequest['cards'];copies:Record<string,number>}[];
 const rows=await page.evaluate(async(decks)=>{
  const clientPath='/src/experimental/universal/client.ts';const {AnalyzerClient}=await import(clientPath);
  const client=new AnalyzerClient(),rows=[];
  for(const deck of decks){
   const start=performance.now();
   const result=await client.run({revision:deck.id,cards:deck.cards,copies:deck.copies,selected:[],mode:'deck-candidates',mana:{W:6,U:6,B:6,R:6,G:6,C:6},library:40});
   rows.push({id:deck.id,name:deck.name,format:deck.format,milliseconds:performance.now()-start,coverage:result.coverage,contexts:result.contextsAttempted,states:result.explored,paths:result.proofs.length,truncated:result.truncated,failedRequiredChecks:result.proofs.flatMap((p:{checks:{role?:string;result:unknown}[]})=>p.checks).filter((c:{role?:string;result:unknown})=>c.role==='required'&&c.result!==true).length,examples:result.proofs.slice(0,2).map((p:{scenario:unknown;events:unknown;spent:unknown;holdings:unknown})=>({scenario:p.scenario,events:p.events,spent:p.spent,holdings:p.holdings}))});
  }
  client.cancel();return rows;
 },decks);
 expect(rows).toHaveLength(30);
 for(const row of rows){expect(row.states).toBeLessThanOrEqual(200);expect(row.failedRequiredChecks).toBe(0);expect(row.coverage.wholeDeckConclusion).toBe(false);expect(row.coverage.copies).toBe(row.format==='commander'?100:60);}
 expect(await allStorage(page)).toEqual(before);
 let memory:unknown={unavailable:true};
 try{
  const cdp=await browser.newBrowserCDPSession();const info=await cdp.send('SystemInfo.getProcessInfo');
  const values=info.processInfo.filter(p=>p.type==='renderer').flatMap(p=>{try{const text=readFileSync(`/proc/${p.id}/status`,'utf8'),match=text.match(/^VmHWM:\s+(\d+) kB/m);return match?[Number(match[1])/1024]:[];}catch{return [];}});
  memory={rendererLifetimeHighWaterMiB:values.length?Math.max(...values):null,note:'Renderer-process lifetime RSS high-water mark; includes app and workers, not isolated worker peak heap.'};await cdp.detach();
 }catch{/* Memory unavailable is explicitly recorded. */}
 mkdirSync('research/browser-adapter/results',{recursive:true});writeFileSync(`research/browser-adapter/results/real-decks-${test.info().project.name}.json`,JSON.stringify({rows,memory,scope:'Hypothetical pairs/triples only, explicit test mana 6 per color and library 40. Unknown unselected influences remain excluded. No whole-deck or independently adjudicated accuracy claim.'},null,2)+'\n');
});
