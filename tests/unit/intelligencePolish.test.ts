import { it, expect } from 'vitest';
import fixtures from '../fixtures/intelligence-polish.json';
import { normalizeCard } from '../../src/import/scryfall';
import { analyze } from '../../src/intelligence/tagger';
import { creatureTypeSignals } from '../../src/intelligence/creatureTypes';
import { tagDefinition } from '../../src/intelligence/taxonomy';
import { card } from '../fixtures/intelligence';
import { RULESET_VERSION } from '../../src/intelligence/types';
// Deterministic snapshots of canonical Scryfall data. No live requests during tests.
export const regressionCards=fixtures.map(data=>normalizeCard(data as Parameters<typeof normalizeCard>[0]));
const expected:[string,string[],string[]][]=[
 ['All Will Be One',['counter-payoff'],['enchantments']],
 ['Bruenor Battlehammer',['equipment','voltron','cost-reduction'],['typal','typal:Each']],
 ['Éowyn, Shieldmaiden',['tokens','card-draw','typal','typal:Human','go-wide'],[]],
 ['Skullclamp',['card-draw','death-triggers','equipment'],['sacrifice-payoff']],
 ["God-Pharaoh's Gift",['graveyard','reanimator','tokens'],['graveyard-hate']],
 ['Leave // Chance',['card-draw','looting','discard-outlet','graveyard'],['recursion']],
 ['Doubling Season',['counter-payoff','token-payoff'],['plus-counters','enchantments']],
 ['Diregraf Colossus',['graveyard','plus-counters','typal','typal:Zombie','graveyard-payoff','tokens'],[]],
 ['Desecrated Tomb',['graveyard-payoff','tokens'],['recursion','artifacts']],
 ['Ghirapur Orrery',['card-draw','extra-land-drops','lands-matter'],['artifacts']],
];
for(const [name,keep,remove] of expected) it(`canonical regression: ${name}`,()=>{
 const fixture=regressionCards.find(c=>c.name===name)!;expect(fixture,name).toBeDefined();
 const ids=analyze(fixture).assignments.map(a=>a.tagId);
 for(const id of keep) expect(ids,`${name} requires ${id}`).toContain(id);
 for(const id of remove) expect(ids,`${name} must exclude ${id}`).not.toContain(id);
});
it('distinguishes a permanent being a type from explicit strategic interaction with it',()=>{
 for(const [type,id] of [['Enchantment','enchantments'],['Artifact','artifacts']]) {
  for(const text of ['',`Whenever you put one or more counters on a permanent, this ${type.toLowerCase()} deals that much damage to target opponent.`]) expect(analyze(card(text,type)).assignments.map(a=>a.tagId)).not.toContain(id);
  expect(analyze(card(`Whenever another ${type.toLowerCase()} enters, draw a card.`,type)).assignments.map(a=>a.tagId)).toContain(id);
 }
});
it('keeps own subtype and token references separate from actual typal payoffs',()=>{
 const own=card('Vigilance','Creature — Human Knight');expect(creatureTypeSignals(own)).toEqual({own:['Human','Knight'],referenced:[],synergy:[]});
 const producer=card('Create two 1/1 white Human creature tokens.');expect(creatureTypeSignals(producer).referenced).toContain('Human');expect(creatureTypeSignals(producer).synergy).not.toContain('Human');
 expect(analyze(card('Other Humans you control get +1/+1.')).assignments.map(a=>a.tagId)).toContain('typal:Human');
});
for(const junk of ['Each','Another','Target','Creature','Permanent','Player','Card']) it(`rejects junk creature type ${junk}`,()=>{
 expect(tagDefinition(`typal:${junk}`)).toBeUndefined();
 expect(creatureTypeSignals(card(`${junk} creature you control gets +2/+0 for each Equipment attached to it.`,`Creature — ${junk}`)).own).not.toContain(junk);
 expect(analyze(card(`${junk} creatures you control get +1/+1.`)).assignments.map(a=>a.tagId)).not.toContain(`typal:${junk}`);
});
it('generic death and aristocrats drain do not imply explicit Sacrifice Payoff',()=>{
 for(const text of ['Whenever another creature dies, draw a card.','Whenever another creature dies, each opponent loses 1 life and you gain 1 life.']) {
  const ids=analyze(card(text)).assignments.map(a=>a.tagId);expect(ids).toContain('death-triggers');expect(ids).not.toContain('sacrifice-payoff');
 }
 expect(analyze(card('Whenever you sacrifice a creature, draw a card.')).assignments.map(a=>a.tagId)).toContain('sacrifice-payoff');
});
it('self-exile is not graveyard denial while opponent/global exile is',()=>{
 for(const text of ['Exile a creature card from your graveyard: Draw a card.','Exile all cards from your graveyard.']) expect(analyze(card(text)).assignments.map(a=>a.tagId)).not.toContain('graveyard-hate');
 for(const text of ["Exile target card from an opponent's graveyard.",'Exile all cards from all graveyards.']) expect(analyze(card(text)).assignments.map(a=>a.tagId)).toContain('graveyard-hate');
});
it('self-cast permission is Graveyard but does not imply Recursion; recovery of other cards does',()=>{
 expect(analyze(card('Aftermath (Cast this spell only from your graveyard. Then exile it.)')).assignments.map(a=>a.tagId)).not.toContain('recursion');
 for(const text of ['Return target card from your graveyard to your hand.','You may cast target creature card from your graveyard this turn.']) expect(analyze(card(text)).assignments.map(a=>a.tagId)).toContain('recursion');
});
it('true discard choices qualify but a forced opponent discard does not',()=>{
 for(const text of ['Discard any number of cards, then draw that many cards.','Discard your hand, then draw three cards.','Discard a card: Draw a card.']) expect(analyze(card(text)).assignments.map(a=>a.tagId)).toContain('discard-outlet');
 expect(analyze(card('Target opponent discards a card.')).assignments.map(a=>a.tagId)).not.toContain('discard-outlet');
});
it('split-card evidence retains each originating half',()=>{
 const leave=regressionCards.find(c=>c.name==='Leave // Chance')!;const result=analyze(leave);
 for(const tag of ['card-draw','looting','discard-outlet']) expect(result.assignments.find(a=>a.tagId===tag)?.evidence.some(e=>e.face==='Chance')).toBe(true);
 expect(result.assignments.find(a=>a.tagId==='graveyard')?.evidence.some(e=>e.face==='Chance')).toBe(true);
});
it('keywords are a canonical metadata layer, not a hard-coded tag list or inferred text list',async()=>{
 const {cardKeywords,collectionKeywords}=await import('../../src/utils/cardKeywords');
 const fixture={...card('Proliferate.'),id:'mechanics',quantity:1,keywords:['Mayhem','Ward','Future Mechanic','ward',''],cardFaces:[{name:'Back',keywords:['Cycling','Mayhem']}]};
 expect(cardKeywords(fixture).map(k=>k.toLowerCase())).toEqual(['cycling','future mechanic','mayhem','ward']);
 expect(cardKeywords(card('Proliferate.'))).toEqual([]);
 expect(collectionKeywords([fixture,fixture])).toHaveLength(4);
});
it('keyword filters and optional Oracle search compose with semantic tags and printing filters',async()=>{
 const {filterCards,emptyFilters,activeFilterCount}=await import('../../src/utils/filters');
 const cards=regressionCards.map((c,i)=>({...c,id:String(i),quantity:1,intelligentTags:analyze(c).assignments.map(a=>a.tagId)}));
 const eowyn=cards.find(c=>c.name==='Éowyn, Shieldmaiden')!;
 expect(filterCards(cards,'',{...emptyFilters,keywords:['first strike'],synergyTags:['tokens']})).toEqual([eowyn]);
 expect(filterCards(cards,'',{...emptyFilters,keywords:['First strike'],commanderColors:['B','G']})).toEqual([]);
 expect(filterCards(cards,'additional land',{...emptyFilters})).toEqual([]);
 expect(filterCards(cards,'additional land',{...emptyFilters,searchIn:'oracle'}).map(c=>c.name)).toEqual(['Ghirapur Orrery']);
 expect(filterCards(cards,'discard any number',{...emptyFilters,searchIn:'all'}).map(c=>c.name)).toEqual(['Leave // Chance']);
 expect(filterCards(cards,'Bruenor',{...emptyFilters,searchIn:'oracle'})).toEqual([]);
 expect(filterCards(cards,'Bruenor',{...emptyFilters,searchIn:'all'})).toHaveLength(1);
 expect(activeFilterCount({...emptyFilters,keywords:['Ward','Cycling']})).toBe(2);
});
it('the new ruleset refreshes prior false positives and preserves manual corrections',async()=>{
 const {processCards}=await import('../../src/intelligence/process');const {cardIdentity,effectiveAssignments}=await import('../../src/intelligence/tagger');
 const fixture=regressionCards.find(c=>c.name==='All Will Be One')!;const identity=cardIdentity(fixture);const previous=await processCards([fixture]);
 previous.auto[identity].rulesetVersion='0.3.0';previous.overrides[identity]={added:['enchantments'],suppressed:['counter-payoff']};
 const next=await processCards([fixture],previous);expect(next.auto[identity].rulesetVersion).toBe(RULESET_VERSION);expect(next.auto[identity].assignments.map(a=>a.tagId)).not.toContain('enchantments');expect(effectiveAssignments(next.auto[identity],next.overrides[identity]).map(a=>a.tagId)).toContain('enchantments');expect(next.overrides).toEqual(previous.overrides);
});
