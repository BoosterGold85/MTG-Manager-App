import { expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { findCard, fixedDecks } from "../audit/recall/harness";
import { dnaFixture, plainCommander, card as fixtureCard } from "../dnaFixtures";
import { candidateScorer, DeckDnaCache, deckDnaCache, deckDnaInput } from "../../src/dna/engine";
import { analyze } from "../../src/intelligence/tagger";
import { typalHits, creatureTypeSignals } from "../../src/intelligence/creatureTypes";
import { extractCardFacts } from "../../src/synergy/facts";
import { capabilities } from "../../src/synergy/capabilities";
import { rankingConstraints } from "../../src/synergy/rankingConstraints";
import { cardFunction } from "../../src/upgrades/cardFunction";
import { strategicRedundancy, deckSpecificValue, RANKING_VERSION } from "../../src/synergy/deckSpecific";
const card=(name:string)=>findCard(name)!;
const profile=()=>deckDnaCache.get(...(() => {const f=dnaFixture(plainCommander,[]);return [f.state,f.deck] as const;})()).strategyProfile;
it("retains every approved canonical fact and capability for the 72 frozen expectation occurrences",()=>{
 const baseline=JSON.parse(readFileSync(new URL("../../docs/recall/completed-results.json",import.meta.url),"utf8"));
 for(const deck of baseline.results)for(const row of deck.expected){
  const c=card(row.candidate);
  expect(extractCardFacts(c)).toEqual(row.facts);
  expect(capabilities(c)).toEqual(row.capabilities);
  expect(analyze(c).assignments).toEqual(row.intelligence);
 }
});
it("reuses identical typal analysis without changing any frozen card result",()=>{
 const names=new Set(fixedDecks.flatMap(d=>d.cards.map(c=>c.name)));
 for(const name of names){const c=card(name);expect(typalHits(c,creatureTypeSignals(c))).toEqual(typalHits(c));expect(analyze(c).creatureTypes).toEqual(creatureTypeSignals(c));}
});
it("unavailable same-name optional tutor cannot receive tutor utility, even under a new name",()=>{
 const c=card("Dragon's Approach"),p=profile();
 expect(rankingConstraints(c,extractCardFacts(c),p).unavailableTutor).toBe(true);
 const renamed={...c,name:"Unseen Approach",oracleId:"new",oracleText:c.oracleText!.replaceAll(c.name,"Unseen Approach")};
 expect(rankingConstraints(renamed,extractCardFacts(renamed),p).unavailableTutor).toBe(true);
 const independent=extractCardFacts(renamed);
 expect(independent.faces.some(f=>f.damage.length>0)).toBe(true);
 const f=dnaFixture(plainCommander,[c]);f.deck.entries!.find(e=>e.name===c.name)!.quantity=5;
 const enough=deckDnaCache.get(f.state,f.deck).strategyProfile;
 expect(rankingConstraints(c,extractCardFacts(c),enough).unavailableTutor).toBe(false);
 expect(rankingConstraints(card("Chaos Warp"),extractCardFacts(card("Chaos Warp")),p).unavailableTutor).toBe(false);
});
it("mandatory hand loss is a downside rather than controlled discard; normal draw is unaffected",()=>{
 const p=profile(),c=card("Grafted Skullcap");
 expect(rankingConstraints(c,extractCardFacts(c),p).forcedHandLoss).toBe(true);
 const renamed={...c,name:"Unseen Skullcap",oracleText:c.oracleText!.replaceAll(c.name,"Unseen Skullcap")};
 expect(rankingConstraints(renamed,extractCardFacts(renamed),p).penalties.some(p=>p.name==="mandatory_hand_loss")).toBe(true);
 const draw={...c,oracleText:"At the beginning of your draw step, draw an additional card."};
 expect(rankingConstraints(draw,extractCardFacts(draw),p).forcedHandLoss).toBe(false);
});
it("ranking caches distinguish semantic/scoring versions, saved contents and Commander changes",()=>{
 const compute=vi.fn(()=>({} as ReturnType<typeof deckDnaCache.get>)),cache=new DeckDnaCache(compute),f=dnaFixture(plainCommander,[card("Sol Ring")]);
 const first=cache.get(f.state,f.deck);
 expect(cache.get(f.state,f.deck)).toBe(first);expect(compute).toHaveBeenCalledTimes(1);
 cache.get(f.state,f.deck,"next semantics");cache.get(f.state,f.deck,undefined,"next scoring");
 expect(compute).toHaveBeenCalledTimes(3);
 f.deck.entries!.find(e=>e.board==="main")!.quantity+=1;cache.get(f.state,f.deck);
 expect(compute).toHaveBeenCalledTimes(4);
 f.deck.commanders[0]={...f.deck.commanders[0],colorIdentity:["R"]};
 // Commander metadata participates in the content revision through its canonical input.
 f.state.metadata[f.deck.commanders[0].scryfallId]={...f.state.metadata[f.deck.commanders[0].scryfallId],colorIdentity:["R"]};
 cache.get(f.state,f.deck);expect(compute).toHaveBeenCalledTimes(5);
 expect(RANKING_VERSION).toBe("0.6.16");
});
it("causal Commander and package evidence remains bounded and duplicate links do not sum indefinitely",()=>{
 const f=dnaFixture(card("Lathliss, Dragon Queen"),[card("Scourge of Valkas"),card("Sol Ring")]);
 const dna=deckDnaCache.get(f.state,f.deck),score=candidateScorer(f.state,f.deck,dna);
 const fit=score(card("Utvara Hellkite")).recommendation!.deckSpecific;
 expect(fit.points).toBeGreaterThan(0);expect(fit.points).toBeLessThanOrEqual(30);
 const generic=score(card("Chaos Warp")).recommendation!.deckSpecific;
 expect(generic.points).toBeLessThan(fit.points);
 expect(generic.neededRole).toBeGreaterThan(0);
});

it("recognizes a seven-card secondary attachment package without promoting incidental support",()=>{
 const equipments=Array.from({length:7},(_,i)=>fixtureCard(`Secondary tool ${i}`,"Artifact — Equipment","Equipped creature gets +1/+1.\nEquip {2}"));
 const value=(count:number)=>{const f=dnaFixture(plainCommander,equipments.slice(0,count)),dna=deckDnaCache.get(f.state,f.deck);return candidateScorer(f.state,f.deck,dna)(card("Brass Squire")).recommendation!.deckSpecific;};
 expect(value(7).quality).toBeGreaterThanOrEqual(0.7);expect(value(2).quality).toBeLessThan(value(7).quality);
});
it("protects relevant repeatable resources, not ordinary saturated rocks",()=>{
 const value={points:24,quality:0.9,families:["blink"],evidence:[],generic:false,neededRole:0};
 expect(!!strategicRedundancy(cardFunction(card("Peregrine Drake")),value)).toBe(true);
 expect(!!strategicRedundancy(cardFunction(card("Sol Ring")),value)).toBe(false);
});

it("one strong causal edge outweighs weak overlap and repeated same-family edges cannot inflate points",()=>{
 const tools=Array.from({length:7},(_,i)=>fixtureCard(`Edge tool ${i}`,"Artifact — Equipment","Equipped creature gets +1/+1.\nEquip {2}"));
 const f=dnaFixture(plainCommander,tools),profile=deckDnaCache.get(f.state,f.deck).strategyProfile;
 const candidate=dnaFixture(card("Brass Squire"),[]);
 const input={...deckDnaInput(candidate.state,candidate.deck).cards[0],commander:false};
 const identity=profile.cards.find(c=>c.card.card.name==="Edge tool 0")!.card.identity;
 const strong={identity,strength:0.9,commander:false};
 const weak=deckSpecificValue(profile,input,Array.from({length:10},()=>({...strong,strength:0.4})));
 const single=deckSpecificValue(profile,input,[strong]);
 const repeated=deckSpecificValue(profile,input,Array.from({length:10},()=>strong));
 expect(single.points).toBeGreaterThan(weak.points);expect(repeated.points).toBe(single.points);
});

it("preserves all previous pairwise desk judgments and rationales verbatim",()=>{
 const previous=new Map<string,{deck:string;candidate:string;label:string;rationale:string}>();
 for(const file of ["precision-review","precision-after"]){
  const sheet=JSON.parse(readFileSync(new URL(`../audit/recall/reviews/${file}.json`,import.meta.url),"utf8"));
  for(const row of sheet.reviews)previous.set(JSON.stringify([row.deck,row.candidate]),row);
 }
 const current=JSON.parse(readFileSync(new URL("../audit/ranking/precision-review.json",import.meta.url),"utf8"));
 for(const row of current.reviews){const old=previous.get(JSON.stringify([row.deck,row.candidate]));if(old){expect(row.label).toBe(old.label);expect(row.rationale).toBe(old.rationale);previous.delete(JSON.stringify([row.deck,row.candidate]));}}
 expect(previous.size).toBe(0);
});
