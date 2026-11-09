import { it, expect } from 'vitest';
import { analyze, ANALYZER_VERSION } from '../../src/experimental/universal/analyze';
import { actions, execute, scenario } from '../../src/experimental/universal/engine';
import { emptyMana } from '../../src/experimental/universal/model';
import { oracleCard } from '../upgradeCandidates';
import { card, mana, tails } from '../fixtures/browserUniversal';
const base = () => ({ id: 'test', revision: 'rev', version: ANALYZER_VERSION, cards: [card('Llanowar Elves')], selected: [], mana: emptyMana(), library: 40 });
const body = (name: string, oracleText = '') => ({ ...oracleCard(name,'{1}',1,'Creature — Human',oracleText,[]),power:'1',toughness:'1' });
it('rejects malformed requests and duplicate card identities before doing search', () => {
  for (const value of [null,{}, {...base(),cards:[base().cards[0],base().cards[0]]}, {...base(),selected:null}, {...base(),mana:null}, {...base(),mode:'catalog',selected:[{id:base().cards[0].scryfallId,zone:'hand'}]}]) expect(()=>analyze(value as unknown as Parameters<typeof analyze>[0])).toThrow();
});
it('reports copy-weighted noncombat coverage without counting unknown cards as understood',()=>{
 const plain=body('Plain'),unknown=body('Unknown','All cards gain unexpected mechanics.');
 const r=analyze({...base(),cards:[plain,unknown],copies:{[plain.scryfallId]:4,[unknown.scryfallId]:2}});
 expect(r.coverage).toMatchObject({nonlandCopies:6,parsedNoncombatCopies:4,parsedNoncombatDistinct:1,wholeDeckConclusion:false});expect(r.explored).toBe(0);
});
it('keeps participant IDs stable and recalculates dependency removal without changing inputs',()=>{
 const producer=body('Producer'),consumer=body('Observer','Whenever another creature enters, you gain 1 life.');
 const input={...base(),cards:[producer,consumer],selected:[{id:producer.scryfallId,zone:'hand' as const},{id:consumer.scryfallId,zone:'battlefield' as const}],mana:{...emptyMana(),C:1},removeId:consumer.scryfallId};
 const snapshot=JSON.stringify(input),r=analyze(input);
 expect(r.proofs.some(p=>p.events.some(e=>e.kind==='gain-life'))).toBe(true);expect(r.counterfactual!.affectedPaths).toBeGreaterThan(0);expect(r.counterfactual!.proofs).toEqual([]);expect(r.totalExplored).toBeLessThanOrEqual(400);expect(JSON.stringify(input)).toBe(snapshot);
});
it('discovers a typed producer/consumer pair without named partners or a requested payoff',()=>{
 const producer=body('New producer'),consumer=body('New observer','Whenever another creature enters, you gain 1 life.');
 const r=analyze({...base(),mode:'deck-candidates',cards:[producer,consumer],mana:{...emptyMana(),C:1}});
 expect(r.proofs.some(p=>p.participants.includes(producer.scryfallId)&&p.participants.includes(consumer.scryfallId))).toBe(true);expect(r.contextsAttempted).toBeGreaterThan(0);expect(r.explored).toBeLessThanOrEqual(200);
 for(const p of r.proofs){expect(p.scenario.length).toBeLessThanOrEqual(3);expect(p.checks.filter(c=>c.role==='required').every(c=>c.result===true)).toBe(true);}
});
it('bounds candidate indexing and never promotes an unknown global effect in a scoped state',()=>{
 const source=body('Source'),observer=body('Observer','Whenever another creature enters, you gain 1 life.'),unknown=body('Unknown','Other creatures trigger twice.');
 const r=analyze({...base(),cards:[source,observer,unknown],selected:[{id:source.scryfallId,zone:'hand'},{id:observer.scryfallId,zone:'battlefield'},{id:unknown.scryfallId,zone:'battlefield'}],mana:{...emptyMana(),C:1}});
 expect(r.proofs).toEqual([]);expect(r.rejections.some(r=>r.status==='Unknown')).toBe(true);
});
it('records colored mana and tap payments with their actual sources',()=>{
 const s=scenario([{card:card('Llanowar Elves'),zone:'battlefield',id:'elf'}]);
 const p=execute(s,actions(s)[0]).find(p=>p.status==='Verified')!;
 expect(p.terminal!.spent.payments).toEqual(expect.arrayContaining([expect.objectContaining({kind:'tap',object:{instance:'elf',incarnation:0},amount:1,evidence:expect.objectContaining({text:expect.stringContaining('{T}')})})]));
 const c=scenario([{card:card('Llanowar Elves'),zone:'hand',id:'elf'}],{mana:mana({G:1})});
 const cast=execute(c,{kind:'cast',instance:'elf'}).find(p=>p.status==='Verified')!;
 expect(cast.terminal!.spent.payments!.find(p=>p.kind==='mana')!.evidence.kind).toBe('printed-cost');
 expect(cast.terminal!.spent.payments!.find(p=>p.kind==='mana')!.mana!.G).toBe(1);
});
it('records life paid separately from payoff life and forbids resolution after fatal costs',()=>{
 const c=body('Life payer','Pay 40 life: Draw a card.'),s=scenario([{card:c,id:'payer',zone:'battlefield'}]);
 const p=execute(s,actions(s)[0]).find(p=>p.status==='Verified')!;
 expect(p.terminal!.spent.life).toBe(40);expect(p.terminal!.spent.payments![0]).toMatchObject({kind:'life',amount:40,evidence:{text:'Pay 40 life: Draw a card.'}});expect(p.terminal!.payoff.draw).toBe(0);
});
it('labels a false resolution branch separately from required legality',()=>{
 const p=execute(tails(false),{kind:'cast',instance:'vehicle'}).find(p=>p.status==='Verified')!;
 expect(p.checks.some(c=>c.role==='branch'&&c.result===false)).toBe(true);expect(p.checks.filter(c=>c.role==='required').every(c=>c.result===true)).toBe(true);
});
it('does not cite permanent-spell resolution for token creation',()=>{
 const c=oracleCard('Token maker','{1}',1,'Sorcery','Create a 1/1 white Soldier creature token.',[]);
 const p=execute(scenario([{card:c,id:'maker',zone:'hand'}],{mana:mana({C:1})}),{kind:'cast',instance:'maker'}).find(p=>p.status==='Verified')!;
 const refs=p.events.find(e=>e.kind==='enter')!.evidence.filter(e=>e.kind==='rules');expect(refs.some(e=>e.rule.includes('CR111'))).toBe(true);expect(refs.some(e=>e.rule.includes('CR608.3'))).toBe(false);
});

it('keeps unsupported layouts Unknown rather than declaring a creature/land card an invalid spell',()=>{
 const c={...body('Unresolved split'),typeLine:'Creature — Human // Land',layout:'modal_dfc'};
 const s=scenario([{card:c,id:'source',zone:'hand'}],{mana:{...emptyMana(),C:1}});
 expect(execute(s,{kind:'cast',instance:'source'})[0].status).toBe('Unknown');
});
