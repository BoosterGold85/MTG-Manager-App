import {analyzerAvailable,ANALYZER_GATES} from '../../src/experimental/universal/activation';
import {it,expect,vi} from 'vitest';
import {withoutCard} from '../../src/experimental/universal/deckPreview';
import {legacyFixture} from '../legacyFixture';
import {analyze,ANALYZER_VERSION} from '../../src/experimental/universal/analyze';
import {emptyMana} from '../../src/experimental/universal/model';
import {oracleCard} from '../upgradeCandidates';
it('removal previews preserve input bytes and remove entry-linked copies',()=>{
 const f=legacyFixture(),before=JSON.stringify(f.state),d=withoutCard(f.state,f.deck,f.weak.scryfallId);
 expect(d.entries?.some(e=>e.scryfallId===f.weak.scryfallId)).toBe(false);expect(d.assignments.some(a=>a.itemId==='weak-owned')).toBe(false);expect(JSON.stringify(f.state)).toBe(before);
});
it('also projects older assignment-only decks without touching stored assignments',()=>{
 const f=legacyFixture(),deck={...f.deck,entries:undefined,assignments:[{itemId:'weak-owned',quantity:3}]};
 expect(withoutCard(f.state,deck,f.weak.scryfallId).assignments).toEqual([]);expect(deck.assignments).toHaveLength(1);
});
it('same-card searches do not surface unrelated supported pairs for an Unknown focus',()=>{
 const body=oracleCard('Body','{1}',1,'Creature — Bear','',[]),observer=oracleCard('Observer','{1}',1,'Creature — Human','Whenever another creature enters, you gain 1 life.',[]),unknown=oracleCard('Unknown focus','{1}',1,'Creature — Human','Do an unresolved action.',[]);
 const r=analyze({id:'focus',revision:'r',version:ANALYZER_VERSION,cards:[body,observer,unknown],focusId:unknown.scryfallId,selected:[],mode:'deck-candidates',mana:{...emptyMana(),C:3},library:40});
 expect(r.proofs).toEqual([]);expect(r.cards.find(c=>c.id===unknown.scryfallId)?.unsupported.length).toBeGreaterThan(0);
});

it('developer build opt-in does not mark independent correctness gates passed',()=>{
 try{vi.stubEnv('MODE','brew-lab');expect(analyzerAvailable()).toBe(true);expect(ANALYZER_GATES.independentlyAdjudicatedCorrectness).toBe('pending');vi.stubEnv('MODE','production');vi.stubEnv('DEV',false);expect(analyzerAvailable()).toBe(false);}finally{vi.unstubAllEnvs();}
});

it('all-copy removal includes other printings of the same Oracle card',()=>{
 const f=legacyFixture();f.state.metadata['other-printing']={...f.weak,scryfallId:'other-printing'};f.state.items.push({...f.state.items[1],id:'other-owned',scryfallId:'other-printing'});const deck={...f.deck,entries:undefined,assignments:[{itemId:'weak-owned',quantity:1},{itemId:'other-owned',quantity:1}]};expect(withoutCard(f.state,deck,f.weak.scryfallId).assignments).toEqual([]);
});
