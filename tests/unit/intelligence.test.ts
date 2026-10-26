import { describe, it, expect } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { taxonomy, tagDefinition } from '../../src/intelligence/taxonomy';
import { analyze, cardIdentity, effectiveAssignments } from '../../src/intelligence/tagger';
import { processCards, canonicalCards, ownedCanonicalCards } from '../../src/intelligence/process';
import { RULESET_VERSION } from '../../src/intelligence/types';
import { creatureTypeSignals } from '../../src/intelligence/creatureTypes';
import { IndexedDbCollectionRepository } from '../../src/storage/collectionRepository';
import { collectionCards, emptyCollection } from '../../src/models/collection';
import { parseManaBox } from '../../src/import/csv';
import { buildImportPlan } from '../../src/import/plan';
import { ScryfallClient, normalizeCard } from '../../src/import/scryfall';
import { filterCards, emptyFilters } from '../../src/utils/filters';
import { sortCards } from '../../src/utils/sorting';
import { card, curated } from '../fixtures/intelligence';
import { sol, meren, forest, metadata, exportCsv, fixtureRow } from '../importFixtures';
describe('central taxonomy',()=>{
 it('has unique definitions, stable IDs, categories and useful descriptions',()=>{
  expect(taxonomy.length).toBe(83); expect(new Set(taxonomy.map(t=>t.id)).size).toBe(taxonomy.length);
  expect(new Set(taxonomy.map(t=>t.label)).size).toBe(taxonomy.length);
  for(const tag of taxonomy) {expect(['strategy','mechanic','role','resource','payoff','enabler','interaction']).toContain(tag.category);expect(tag.description.length).toBeGreaterThan(10);expect(tag.id).toMatch(/^[a-z-]+$/);}
  expect(tagDefinition('typal:Elf')?.label).toBe('Elves Matter');
 });
});
describe('curated transparent rules',()=>{
 for(const [label,fixture,expected] of curated) it(label,()=>{
  const result=analyze(fixture); const ids=result.assignments.map(a=>a.tagId);
  for(const id of expected) expect(ids,`${label}: missing ${id}`).toContain(id);
  expect(new Set(ids).size).toBe(ids.length);
  for(const assignment of result.assignments) {expect(assignment.cardIdentity).toBe(cardIdentity(fixture));expect(assignment.rulesetVersion).toBe(RULESET_VERSION);expect(assignment.confidence).toBeGreaterThanOrEqual(.75);expect(assignment.confidence).toBeLessThanOrEqual(1);expect(assignment.evidence.length).toBeGreaterThan(0);expect(assignment.evidence.every(e=>e.field && e.reason && e.snippet.length<=180)).toBe(true);}
 });
 const negatives:[string,string,string[]][]=[
  ['draw restriction',"Players can't draw cards.",['card-draw','looting']],
  ['gain restriction',"You can't gain life.",['lifegain','drain']],
  ['draw skip','Skip your draw step.',['card-draw']],
  ['draw trigger','Whenever an opponent draws a card, create a Treasure token.',['card-draw']],
  ['token restriction',"Creature tokens can't attack.",['tokens','token-payoff']],
  ['death alone','Whenever another creature dies, scry 1.',['aristocrats']],
  ['opponent mill','Target opponent mills three cards.',['self-mill']],
  ['forced sacrifice','Each opponent sacrifices a creature.',['sacrifice-outlet','aristocrats']],
  ['counter noun','Put a +1/+1 counter on this creature.',['counterspell']],
  ['grave hate','Exile all cards from all graveyards.',['removal','board-wipe','recursion']],
  ['token copy','Create a token that is a copy of target creature.',['copy-spells']],
  ['blink','Exile target creature you control, then return that card to the battlefield.',['removal']],
 ];
 for(const [label,text,excluded] of negatives) it(`excludes ${label}`,()=>{const ids=analyze(card(text)).assignments.map(a=>a.tagId);for(const id of excluded)expect(ids).not.toContain(id);});
 it('does not label a basic land Ramp or an ordinary Elf a typal payoff',()=>{
  expect(analyze(card('{T}: Add {G}.','Basic Land — Forest')).assignments.map(a=>a.tagId)).not.toContain('ramp');
  expect(creatureTypeSignals(card('{T}: Add {G}.','Creature — Elf Druid'))).toEqual({own:['Druid','Elf'],referenced:[],synergy:[]});
  expect(analyze(card('{T}: Add {G}.','Creature — Elf Druid')).assignments.some(a=>a.tagId.startsWith('typal'))).toBe(false);
 });
 it('merges evidence and retains the strongest confidence',()=>{
  const result=analyze(card('Proliferate.\nProliferate.',undefined,{keywords:['Proliferate']}));
  expect(result.assignments.filter(a=>a.tagId==='proliferate')).toHaveLength(1);expect(result.assignments[0].confidence).toBe(1);
 });
 it('uses every face, retains originating face and canonical extra fields',()=>{
  const result=normalizeCard({object:'card',id:'multiface',oracle_id:'oracle',name:'Front // Back',set:'tst',set_name:'Test',collector_number:'1',cmc:2,color_identity:['G'],type_line:'Creature // Enchantment',rarity:'rare',keywords:['Proliferate'],produced_mana:['G'],layout:'transform',card_faces:[{name:'Front',type_line:'Creature — Elf',oracle_text:'Draw a card.',power:'1',toughness:'1'},{name:'Back',type_line:'Enchantment',oracle_text:'Proliferate.'}]});
  expect(result.oracleId).toBe('oracle');expect(result.layout).toBe('transform');expect(result.producedMana).toEqual(['G']);expect(result.cardFaces?.[0].power).toBe('1');
  const analysis=analyze(result);expect(analysis.assignments.find(a=>a.tagId==='card-draw')?.evidence[0].face).toBe('Front');expect(analysis.assignments.find(a=>a.tagId==='proliferate')?.evidence[0]).toMatchObject({face:'Back',field:'cardFaces[1].oracleText'});expect(analysis.assignments.find(a=>a.tagId==='proliferate')?.evidence.every(e=>e.face==='Back')).toBe(true);
 });
});
describe('lifecycle and persistence',()=>{
 it('persists results and overrides across reload, recalculation and stale rulesets',async()=>{
  const c=card('Draw a card.');const key=cardIdentity(c);const intelligence=await processCards([c]);
  intelligence.overrides[key]={added:['tokens'],suppressed:['card-draw']};
  const repo=new IndexedDbCollectionRepository('intelligence',new IDBFactory());const state={...emptyCollection(),revision:1,intelligence};await repo.save(state,0);
  const loaded=(await repo.load())!;expect(loaded.intelligence).toEqual(intelligence);
  for(const force of [false,true]) {const next=await processCards([c],loaded.intelligence,force);expect(next.overrides[key]).toEqual(intelligence.overrides[key]);expect(effectiveAssignments(next.auto[key],next.overrides[key]).map(a=>a.tagId)).toEqual(['tokens']);expect(next.auto[key].assignments[0].tagId).toBe('card-draw');}
  const stale={...intelligence,auto:{[key]:{...intelligence.auto[key],rulesetVersion:'0.2.9'}}};
  expect((await processCards([c],stale)).auto[key].rulesetVersion).toBe(RULESET_VERSION);
  const current=await processCards([c],intelligence);expect(current.auto[key]).toBe(intelligence.auto[key]);
 });
 it('migrates name fallback corrections when Oracle ID becomes available and shares printings',async()=>{
  const c=card('Draw a card.');const initial=await processCards([c]);initial.overrides[cardIdentity(c)]={added:['tokens'],suppressed:['card-draw']};
  const richer={...c,oracleId:'oracle-shared',scryfallId:'printing-2'};
  const next=await processCards([c,richer],initial);expect(canonicalCards([c,richer])).toHaveLength(1);expect(next.overrides['oracle-shared']).toEqual(initial.overrides[cardIdentity(c)]);
 });
 it('handles thousands of records using canonical reuse, yielding and reporting full progress',async()=>{
  const records=Array.from({length:6000},(_,i)=>card('Draw a card.',undefined,{scryfallId:`print-${i}`,oracleId:`oracle-${i%100}`,name:`Card ${i%100}`}));
  const progress:number[]=[];let heartbeat=false;setTimeout(()=>{heartbeat=true;},0);
  const next=await processCards(records,undefined,false,(done)=>progress.push(done));
  expect(Object.keys(next.auto)).toHaveLength(100);expect(progress.at(-1)).toBe(100);expect(heartbeat).toBe(true);
 });
 it('does not process current rulesets and supports cancellation',async()=>{
  const c=card('Draw a card.');const next=await processCards([c]);const progress:number[]=[];await processCards([c],next,false,(_done,total)=>progress.push(total));expect(progress).toEqual([0]);
  const controller=new AbortController();controller.abort();await expect(processCards([c],undefined,true,()=>{},controller.signal)).rejects.toMatchObject({name:'AbortError'});
 });
 it('keeps overrides and sources through import and safely ignores unmatched cards',async()=>{
  const parsed=parseManaBox(exportCsv([fixtureRow(sol),fixtureRow(meren)]));const resolver=new ScryfallClient(undefined,0);
  const resolved=await resolver.resolve(parsed.rows,metadata,{},new AbortController().signal,()=>{});
  const first=buildImportPlan(parsed,resolved,null,'test.csv').next;
  first.intelligence=await processCards(first.items.map(i=>first.metadata[i.scryfallId]));
  first.intelligence.overrides[cardIdentity(sol)]={added:['tokens'],suppressed:['ramp']};
  const again=buildImportPlan(parsed,resolved,first,'test.csv').next;again.intelligence=await processCards(again.items.map(i=>again.metadata[i.scryfallId]),again.intelligence);
  expect(again.items).toEqual(first.items);expect(again.intelligence).toEqual(first.intelligence);
  expect(collectionCards(again).find(c=>c.name==='Sol Ring')?.intelligentTags).toContain('tokens');
  const unresolved=buildImportPlan(parsed,{results:new Map(),nameMatches:{}},again,'bad.csv').next;expect(()=>collectionCards(unresolved)).not.toThrow();
 });
});
it('intelligent filters combine ANY/ALL with search, Commander Colors, normal color, type and sort',()=>{
 const cards=[{...sol,intelligentTags:['ramp','artifacts']},{...forest,intelligentTags:['lands-matter']},{...meren,intelligentTags:['graveyard','recursion']}];
 expect(filterCards(cards,'',{...emptyFilters,synergyTags:['ramp','graveyard']})).toHaveLength(2);
 expect(filterCards(cards,'',{...emptyFilters,synergyTags:['ramp','artifacts'],tagMatch:'ALL'})).toHaveLength(1);
 expect(filterCards(cards,'',{...emptyFilters,synergyTags:['ramp','graveyard'],tagMatch:'ALL'})).toHaveLength(0);
 expect(filterCards(cards,'meren',{...emptyFilters,synergyTags:['graveyard'],commanderColors:['B','G'],colors:['B'],types:['Creature']})).toHaveLength(1);
 expect(filterCards(cards,'',{...emptyFilters,synergyTags:['graveyard'],commanderColors:['U']})).toHaveLength(0);
 expect(sortCards(filterCards(cards,'',{...emptyFilters,synergyTags:['ramp','graveyard']}),'name').map(c=>c.name)).toEqual(['Meren of Clan Nel Toth','Sol Ring']);
});

it('recognizes real bundled graveyard recursion with multi-sentence antecedents',()=>{
 for(const name of ['Reanimate','Victimize','Meren of Clan Nel Toth']) { const fixture=Object.values(metadata).find(c=>c.name===name)!;const ids=analyze(fixture).assignments.map(a=>a.tagId);expect(ids,name).toContain('recursion');expect(ids,name).toContain('reanimator'); }
});

it('refreshes changed canonical text while leaving user corrections intact',async()=>{
 const c=card('Draw a card.');const initial=await processCards([c]);initial.overrides[cardIdentity(c)]={added:['tokens'],suppressed:['card-draw']};const next=await processCards([{...c,oracleText:'Proliferate.'}],initial);expect(next.auto[cardIdentity(c)].assignments.map(a=>a.tagId)).toContain('proliferate');expect(next.overrides).toEqual(initial.overrides);
});

it('manual additions take precedence even when a later rule also assigns the tag',()=>{
 const auto=analyze(card('Draw a card.'));const result=effectiveAssignments(auto,{added:['card-draw'],suppressed:[]});expect(result).toHaveLength(1);expect(result[0].source).toBe('manual-add');expect(result[0].evidence.some(e=>e.field==='oracleText')).toBe(true);
});

it('uses cached Oracle identity consistently even when that printing has been locally removed',async()=>{
 const parsed=parseManaBox(exportCsv([fixtureRow(sol)]));const resolved=await new ScryfallClient(undefined,0).resolve(parsed.rows,metadata,{},new AbortController().signal,()=>{});const state=buildImportPlan(parsed,resolved,null,'cards.csv').next;state.metadata['cached-printing']={...state.metadata[sol.scryfallId],scryfallId:'cached-printing',oracleId:'known-oracle'};const canonical=ownedCanonicalCards(state);expect(canonical).toHaveLength(1);expect(cardIdentity(canonical[0])).toBe('known-oracle');state.intelligence=await processCards(canonical);state.intelligence.overrides['known-oracle']={added:['tokens'],suppressed:[]};expect(collectionCards(state)[0].intelligentTags).toContain('tokens');expect(collectionCards(state)[0].analysis?.cardIdentity).toBe('known-oracle');
});
