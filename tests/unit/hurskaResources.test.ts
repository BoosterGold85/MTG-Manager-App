import {describe,it,expect,vi} from "vitest";
import {hurskaCards as cards,hurskaCard as card,hurskaFixture} from "../hurskaFixture";
import {oracleCard} from "../upgradeCandidates";
import {dnaFixture} from "../dnaFixtures";
import {cardCoverage} from "../../src/upgrades/coverage";
import {cardFunction,deckCardFunction} from "../../src/upgrades/cardFunction";
import {effectConditions,SupplyIndex} from "../../src/upgrades/conditions";
import {resourceSemantics,suppliesLifeGain,suppliesResourceSacrifice} from "../../src/synergy/resources";
import {capabilityRelationship} from "../../src/synergy/capabilities";
import {extractCardFacts} from "../../src/synergy/facts";
import {deckDnaInput} from "../../src/dna/engine";
import {buildDeckStrategyProfile} from "../../src/dna/strategy";
import {scoreRecommendation} from "../../src/synergy/recommendation";
import {canonicalInput} from "../../src/upgrades/inputs";
const fake=(name:string,text:string,type="Enchantment")=>oracleCard(name,"{2}{G}",3,type,text,["G"]);
const renamed=(c:ReturnType<typeof card>)=>({...c,name:"Renamed Fixture",oracleId:`renamed:${c.name}`,oracleText:c.oracleText?.split(c.name).join("Renamed Fixture").split(c.name.split(/[ ,]/)[0]).join("Renamed Fixture")});
const hurska=card("Hurska Sweet-Tooth");
const links=(commander:ReturnType<typeof card>,candidate:ReturnType<typeof card>)=>{
 const f=dnaFixture(commander,[]),p=buildDeckStrategyProfile(deckDnaInput(f.state,f.deck));
 return scoreRecommendation(p,canonicalInput(f.state,candidate)).recommendation!.commander;
};
describe("Food and life-gain event semantics",()=>{
 it("does not let observers bootstrap their own life-gain event",()=>{
  for(const c of [fake("Observer","Whenever you gain life, draw a card."),card("Well of Lost Dreams"),card("Nykthos Paragon")])expect(suppliesLifeGain(c)).toBe(false);
  expect(suppliesLifeGain(fake("Life","You gain 3 life.","Sorcery"))).toBe(true);
  expect(suppliesLifeGain(fake("Enemy","Target opponent gains 3 life.","Sorcery"))).toBe(false);
  const condition=effectConditions(hurska).find(c=>c.key==="lifegain")!;
  expect(condition.supplies(card("Well of Lost Dreams"))).toBe(false);
 });
 it("recognizes Food access with costs, without attaching life gain to all sacrifices",()=>{
  const creator=fake("Chef","Create a Food token.","Sorcery");
  expect(suppliesLifeGain(creator)).toBe(true);
  expect(capabilityRelationship(creator,hurska).join(" ")).toContain("tap and sacrifice that Food");
  expect(suppliesLifeGain(fake("Food Draw","Sacrifice three Foods: Draw a card."))).toBe(false);
  expect(suppliesLifeGain(fake("Food Mana","{T}, Sacrifice a Food: Add {G}."))).toBe(false);
  expect(suppliesLifeGain(fake("Enemy Chef","Create a Food token under an opponent's control.","Sorcery"))).toBe(false);
  expect(suppliesLifeGain(fake("Food Type Alone","","Artifact — Food"))).toBe(false);
 });
 it("binds Food-sacrifice conditions and cache keys to the resource",()=>{
  const c=effectConditions(card("Nuka-Cola Vending Machine")).find(c=>c.key==="sacrifice:food")!;
  for(const s of [fake("Treasure Maker","Create a Treasure token."),fake("Treasure Draw","Sacrifice a Treasure: Draw a card."),card("Academy Manufactor")])expect(c.supplies(s)).toBe(false);
  expect(c.supplies(fake("Food Draw","Sacrifice three Foods: Draw a card."))).toBe(true);
  expect(suppliesResourceSacrifice(fake("Observer","Whenever you sacrifice a Food, draw a card."),"Food")).toBe(false);
  expect(suppliesResourceSacrifice(fake("Tap Only","{T}: Add {G}."),"Food")).toBe(false);
 });
 it("models replacements as transformations requiring incoming events",()=>{
  for(const name of ["Alhammarret's Archive","The Wind Crystal","Rhox Faithmender"]){
   expect(resourceSemantics(card(name)).lifeMultiplier).toBe(2);
   expect(capabilityRelationship(card(name),hurska).join(" ")).toContain("does not originate life gain");
  }
  expect(suppliesLifeGain(fake("Only Replacement","If you would gain life, you gain twice that much life instead."))).toBe(false);
  const m=card("Academy Manufactor");expect(resourceSemantics(m).createsTokens).toBe(false);
  expect(capabilityRelationship(m,hurska).join(" ")).toContain("incoming event");
  expect(capabilityRelationship(m,fake("Blank","","Creature"))).toEqual([]);
  expect(capabilityRelationship(card("Peregrin Took"),hurska).join(" ")).toContain("adds Food");
 });
 it("models Sam's activation discount and turn-scoped Food grants separately",()=>{
  const sam=card("Sam, Loyal Attendant");
  expect(resourceSemantics(sam).foodDiscount).toBe(true);
  expect(capabilityRelationship(sam,hurska).join(" ")).toContain("colored costs, tapping and sacrifices remain");
  expect(resourceSemantics(card("Gourmand's Talent")).foodGrant).toBe(true);
  expect(capabilityRelationship(card("Gourmand's Talent"),sam).join(" ")).toContain("during your turn");
  const f=hurskaFixture();const supply=new SupplyIndex(cards.map(c=>({card:c,quantity:1,commander:c===hurska})));
  expect(f.deck.entries!.reduce((n,e)=>n+e.quantity,0)).toBe(100);
  expect(deckCardFunction(sam,supply).roles.tutors).toBeUndefined();
  expect(cardFunction(card("Well of Lost Dreams")).impactReasons.join(" ")).toContain("optional {X} payment");
  expect(cardFunction(hurska).impactReasons.join(" ")).toContain("optional {G/W} payment");
 });
 it("requires actual power-increasing support for Kutzil's combat condition",()=>{
  const kutzil=card("Kutzil, Malamet Exemplar"),plain=fake("Plain","","Creature — Elf");
  expect(links(kutzil,plain).score).toBe(0);
  expect(links(kutzil,hurska).evidence.join(" ")).toContain("combat damage to a player is still required");
  const c=effectConditions(kutzil).find(c=>c.key==="combat:power-above-base")!;
  expect(c.understood).toBe(true);expect(c.supplies(plain)).toBe(false);expect(c.supplies(hurska)).toBe(true);
  expect(c.supplies(card("Lathiel, the Bounteous Dawn"))).toBe(true);
  expect(c.supplies(fake("Equipment Boost","Equipped creature gets +2/+2.","Artifact — Equipment"))).toBe(true);
  expect(c.supplies(fake("Enemy Boost","Target creature an opponent controls gets +2/+2.","Instant"))).toBe(false);
 });
 it("recognizes X-target modal removal and preserves recipient choice for life gain",()=>{
  const c=card("Heliod's Intervention"),fn=cardFunction(c);
  expect(fn.roles.interaction).toBeGreaterThan(0);
  expect(fn.answers.some(a=>a.targets.includes("artifact")&&a.targets.includes("enchantment"))).toBe(true);
  expect(fn.roles.wipes).toBeUndefined();
  expect(capabilityRelationship(c,hurska).join(" ")).toContain("you are the chosen recipient");
  expect(resourceSemantics(fake("Enemy Life","Target opponent gains twice X life.","Instant")).targetedLife).toBe(false);
 });
 it("resolves land subtypes without inventing basic-only restrictions",()=>{
  for(const name of ["Farseek","Nature's Lore"]){const c=card(name);expect(cardFunction(c).roles.ramp).toBeGreaterThan(0);const s=extractCardFacts(c).faces[0].searchesLibrary[0];expect(s.targetTypes).toContain("Land");expect(s.basicOnly).toBe(false);}
  expect(extractCardFacts(card("Nature's Lore")).faces[0].searchesLibrary[0].restrictions.join(" ")).toContain("Forest");
  expect(extractCardFacts(card("Farseek")).faces[0].searchesLibrary[0].restrictions.join(" ")).not.toContain("Forest");
 });
 it("does not count target-controller compensation as your inventory",()=>{
  const path=fake("Enemy Path","Exile target creature an opponent controls. Its controller may search their library for a basic land card, put that card onto the battlefield tapped, then shuffle.","Instant");
  expect(cardFunction(path).roles.ramp).toBeUndefined();
  expect(cardFunction(card("Path to Exile")).roles.ramp).toBeUndefined();
  expect(cardFunction(card("Generous Gift")).roles.tokens).toBeUndefined();
  expect(cardFunction(card("Beast Within")).roles.tokens).toBeUndefined();
 });
 for(const c of cards)it(`${c.name}: covers the canonical ability shapes without name exceptions`,()=>{
  for(const variant of [c,renamed(c)])expect(cardCoverage(variant).abilities.filter(a=>a.status==="unsupported")).toEqual([]);
 });
 it("runs the supplied 100-card deck offline without saved-data changes",()=>{
  const f=hurskaFixture(),before=JSON.stringify(f.state),network=vi.spyOn(globalThis,"fetch").mockImplementation(()=>{throw new Error("Unexpected fetch");});
  try{const p=buildDeckStrategyProfile(deckDnaInput(f.state,f.deck));for(const c of cards)expect(Number.isFinite(scoreRecommendation(p,canonicalInput(f.state,c)).score)).toBe(true);expect(JSON.stringify(f.state)).toBe(before);expect(network).not.toHaveBeenCalled();}finally{network.mockRestore();}
 });
});
