import {it,expect} from 'vitest';
import {reignOfDragonsFixture,canonicalFactsCards} from '../recommendationFixtures';
import {synergyFixture} from '../synergyFixtures';
import {oracleCard} from '../upgradeCandidates';
import {improveCurrentDeck} from '../../src/upgrades';
import {candidateScorer,deckDnaCache} from '../../src/dna/engine';
import {swapInteractions,selectInteractions} from '../../src/presentation/swapInteractions';
import baseline from '../data/phase1-reign-baseline.json';
const fixture=()=>{const f=reignOfDragonsFixture();for(const c of canonicalFactsCards){f.state.metadata[c.scryfallId]=c;f.state.items.push(synergyFixture().owned(c,c.scryfallId,1));}return f;};
it('shows verified Wayfinder/Lathliss evidence while retaining all pre-change decisions and state',()=>{
 const f=fixture(),before=JSON.stringify(f.state),rows=improveCurrentDeck(f.state,f.deck);
 expect(rows.map(c=>({identity:c.identity,upgrade:c.upgrade,build:c.build}))).toEqual(baseline);
 const w=rows.find(c=>c.canonical.name==='Changeling Wayfinder')!;
 const evidence=swapInteractions(f.state,f.deck,w.canonical,w.upgrade.best!.cut);
 expect(evidence.some(e=>e.partner==='Lathliss, Dragon Queen'&&/Changeling makes.*a Dragon/.test(e.evidence))).toBe(true);
 expect(evidence.some(e=>e.partner===w.upgrade.best!.cutName)).toBe(false);
 expect(JSON.stringify(f.state)).toBe(before);
 expect(improveCurrentDeck(f.state,f.deck).map(c=>({identity:c.identity,upgrade:c.upgrade,build:c.build}))).toEqual(baseline);
});
it('does not turn token Dragon creation into a nontoken-entry interaction',()=>{
 const f=fixture(),card=oracleCard('Token source','{3}{R}',4,'Sorcery','Create a 5/5 red Dragon creature token with flying.',['R']);
 const rec=candidateScorer(f.state,f.deck,deckDnaCache.get(f.state,f.deck))(card).recommendation;
 const rows=selectInteractions(rec,new Set(f.deck.commanders.map(c=>c.cardIdentity)));
 expect(rows.some(r=>r.partner==='Lathliss, Dragon Queen')).toBe(false);
});
it('requires surviving identity, sufficient verified link strength and engine causal evidence',()=>{
 const rec={links:[{identity:'gone',name:'Removed partner',strength:1,evidence:['Verified but removed'],commander:false},{identity:'tag',name:'Shared tag',strength:1,evidence:[],commander:false},{identity:'weak',name:'Weak',strength:0.1,evidence:['weak'],commander:false}]};
 expect(selectInteractions(rec as never,new Set(['tag','weak']))).toEqual([]);
 expect(selectInteractions(undefined,new Set())).toEqual([]);
});
it('recomputes evidence without a removed real Dragon partner',()=>{
 const f=fixture(),w=canonicalFactsCards.find(c=>c.name==='Changeling Wayfinder')!;
 const removed=f.deck.entries!.find(e=>e.name==='Dragon Tempest')!;
 const before=JSON.stringify(f.state);
 expect(swapInteractions(f.state,f.deck,w,removed.cardIdentity).some(e=>e.partner==='Dragon Tempest')).toBe(false);
 expect(JSON.stringify(f.state)).toBe(before);
});

it('drops evidence that cites a removed third partner even when the main partner survives',()=>{
 const rec={links:[{identity:'live',name:'Surviving partner',strength:1,commander:false,evidence:['Uses Removed partner to feed Surviving partner.']}]};
 expect(selectInteractions(rec as never,new Set(['live']),['Removed partner'])).toEqual([]);
});
