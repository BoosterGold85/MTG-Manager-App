import { rankingConstraints } from "./rankingConstraints";
// Bounded normal recommendation value. Evidence is v0.6.15 Oracle/relationship
// data; no named cards, frozen labels, popularity or new parsing rules.
import type { DnaInputCard } from "../dna/engine";
import type { DeckStrategyProfile } from "../dna/strategy";
import { capabilities } from "./capabilities";
import { deckCardFunction } from "../upgrades/cardFunction";
import { hasSelfEntryAbility } from "../upgrades/abilityScope";
import { effectConditions, sharedSupplyIndex } from "../upgrades/conditions";
import type { CardFunction, Need } from "../upgrades/cardFunction";
export const RANKING_VERSION = "0.6.16";
export const RANKING_POLICY = Object.freeze({ specific: true, utilityCap: true, strategicRedundancy: true });
export interface DeckSpecificValue {
  points: number;
  quality: number;
  families: string[];
  evidence: string[];
  generic: boolean;
  neededRole: number;
}
const SUPPORT = new Set(["ramp","advantage","interaction","drawEngine"]);
const roleNames: Partial<Record<Need,string>> = { interaction:"removal",wipes:"boardWipes",tokens:"tokenGeneration",sacrificeOutlets:"sacrificeOutlet",cardAdvantage:"cardAdvantage",ramp:"ramp",recursion:"recursion",protection:"protection",tutors:"tutors",finishers:"finishers" };
const contexts = new WeakMap<DeckStrategyProfile, ReturnType<typeof makeContext>>();
function makeContext(profile: DeckStrategyProfile) {
  const members = new Map<string,Set<string>>(), anchors = new Set<string>();
  for (const c of profile.cards) {
    for (const family of c.features.keys()) {
      if (SUPPORT.has(family)) continue;
      if (!members.has(family)) members.set(family,new Set());
      if (!c.card.commander) members.get(family)!.add(c.card.identity);
      if (c.card.commander && (!family.startsWith("typal:") || c.card.analysis.creatureTypes.synergy.includes(family.slice(6)))) anchors.add(family);
    }
    if (c.card.commander) {
      const a=capabilities(c.card.card);
      if (a.blink || a.friendlyBounce) anchors.add("blink");
      if (a.permanentCopy) anchors.add("clones");
      if (a.counterReplacement) anchors.add("counters");
    }
  }
  const payoffs = new Map<string,number>();
  for(const c of profile.cards){
    const families=new Set(effectConditions(c.card.card).map(x=>familyOf(x.key)).filter(x=>x!==undefined));
    for(const r of c.receivers.filter(r=>!r.selfOnly)){
      if(r.objects.includes("Artifact"))families.add("artifacts");
      if(r.event==="dies"||r.event==="sacrifice")families.add("sacrifice");
    }
    for(const family of families)payoffs.set(family,(payoffs.get(family)||0)+1);
  }
  const supply = sharedSupplyIndex(profile);
  const importance = (family:string) => anchors.has(family) ? 1 : (members.get(family)?.size || 0) >= 7 && (["voltron","vehicles","blink","clones","lands","counters","graveyard"].includes(family) || (payoffs.get(family)||0)>=2) ? 0.8 : (members.get(family)?.size || 0) >= 3 ? 0.25 : 0;
  const byMember=new Map<string,string[]>();
  for(const [family,ids] of members)for(const id of ids){if(!byMember.has(id))byMember.set(id,[]);byMember.get(id)!.push(family);}
  return {members,byMember,anchors,supply,importance};
}
function familyOf(key:string) {
  if (key.startsWith("counters:")) return "counters";
  if (key === "token") return "tokens";
  if (/^reuse:/.test(key)) return "blink";
  if (/^(?:attach:|.*equipment)/i.test(key)) return "voltron";
  if (/^(?:animate:|.*vehicle)/i.test(key)) return "vehicles";
  if (/^named-copies:/.test(key)) return "clones";
  if (key === "enters:land") return "lands";
  if (/instant|sorcery|noncreature/.test(key)) return "spells";
  if (/artifact|historic/.test(key)) return "artifacts";
  if (/graveyard|self-mill/.test(key)) return "graveyard";
  if (/dies|sacrifice/.test(key)) return "sacrifice";
  return undefined;
}
export function deckSpecificValue(profile:DeckStrategyProfile,input:DnaInputCard,links:{identity:string;strength:number;commander:boolean}[]): DeckSpecificValue {
  let ctx=contexts.get(profile);
  if (!ctx) contexts.set(profile,ctx=makeContext(profile));
  const fn=deckCardFunction(input.card,ctx.supply), cap=capabilities(input.card);
  const outputScale=fn.roles.tokens && !cap.permanentCopy && (ctx.members.get("tokens")?.size||0)<3 ? 0.5 : 1;
  let quality=0;
  const matched=new Set<string>(), evidence:string[]=[];
  const credit=(family:string,amount:number,why:string)=>{
    const important=ctx!.importance(family);
    if (!important || amount<=0) return;
    const value=amount*important*outputScale;
    quality=Math.max(quality,value);
    if(value>=0.3){matched.add(family);evidence.push(why);}
  };
  for (const c of fn.conditions || []) {
    const family=familyOf(c.key);
    if(family && c.understood && c.factor>0) credit(family,c.factor*(family==="artifacts"&&!ctx.anchors.has(family)?0.5:1),`${family}: ${c.suppliers.slice(0,4).join(", ")} supplies ${c.needs}.`);
  }
  const tags=new Set(input.assignments.map(a=>a.tagId));
  const compatible=(family:string)=>{
    if(family==="counters")return cap.counterReplacement||fn.conditions?.some(c=>c.key.startsWith("counters:"))||tags.has("plus-counters")?1:0;
    if(family==="sacrifice")return fn.roles.sacrificeOutlets||cap.artifactDeathPayoff||fn.facts.faces.some(f=>f.triggers.some(t=>/dies|sacrifice/i.test(t)))?1:0;
    if(family==="graveyard")return fn.roles.recursion?1:fn.roles.controlledDiscard?0.6:tags.has("self-mill")?0.8:0;
    if(family==="blink")return cap.blink||cap.friendlyBounce?1:hasSelfEntryAbility(input.card)?0.9:0;
    if(family==="clones")return cap.permanentCopy||fn.conditions?.some(c=>c.key.startsWith("named-copies"))?1:hasSelfEntryAbility(input.card)||fn.repeatable&&!/Legendary/.test(input.card.typeLine)?0.6:0;
    if(family==="voltron")return cap.attach||/Equipment|Aura/.test(input.card.typeLine)?1:0;
    if(family==="vehicles")return cap.animateVehicle||cap.crewReduction||/Vehicle/.test(input.card.typeLine)?1:0;
    if(family==="tokens")return fn.roles.tokens||Object.keys(fn.engines.tokenMultipliers).length?1:0;
    if(family==="lands")return cap.graveyardLandPlay||fn.conditions?.some(c=>c.key==="enters:land")?1:fn.facts.typedRoles.includes("land_ramp")?0.65:0;
    if(family==="spells")return fn.conditions?.some(c=>/instant|sorcery|noncreature/.test(c.key))?1:/Instant|Sorcery/.test(input.card.typeLine)?0.6:0;
    if(family==="artifacts")return ctx!.anchors.has(family)?1:0.5;
    if(family==="enchantments")return /Enchantment/.test(input.card.typeLine)?0.6:0;
    if(family==="lifegain")return tags.has("lifegain")||tags.has("lifegain-payoff")?0.8:0;
    if(family==="damage"||family==="pings")return fn.engines.noncombatDamageSources||fn.engines.damageMultipliers?0.9:0;
    if(family==="combat")return fn.engines.attackTriggers||fn.engines.extraCombats?1:0;
    if(family.startsWith("typal:"))return input.analysis.creatureTypes.own.includes(family.slice(6))||input.analysis.creatureTypes.synergy.includes(family.slice(6))?1:0;
    return 0;
  };
  const causalByFamily=new Map<string,{strength:number;count:number}>();
  for(const link of links){
    if(link.commander||link.strength<0.8)continue;
    for(const family of ctx.byMember.get(link.identity)||[]){
      const known=causalByFamily.get(family)||{strength:0,count:0};
      known.strength=Math.max(known.strength,link.strength);known.count++;
      causalByFamily.set(family,known);
    }
  }
  for(const [family,causal] of causalByFamily)credit(family,causal.strength*compatible(family),`${family.startsWith("typal:")?family.slice(6)+" creatures":family}: works with ${causal.count} cards in this deck.`);
  // A reusable entry resource is strategically useful even when generic ramp is saturated.
  if(cap.landUntap && links.some(l=>l.strength>=0.8) && ctx.anchors.has("blink")) credit("blink",1,"A real blink package reuses its entry mana resource.");
  if(fn.roles.recursion && ctx.anchors.has("graveyard") && links.some(l=>l.strength>=0.8)) credit("graveyard",0.9,"Scoped recursion serves the Commander's graveyard package.");
  const commander=Math.max(0,...links.filter(l=>l.commander).map(l=>l.strength));
  let neededRole=0;
  for(const [need,amount] of Object.entries(fn.intrinsicRoles || fn.roles)){
    if(need==="tutors"&&rankingConstraints(input.card,fn.facts,profile).unavailableTutor)continue;
    const role=roleNames[need as Need], deficit=role ? profile.roleNeeds[role as keyof typeof profile.roleNeeds]?.deficit || 0 : 0;
    neededRole=Math.max(neededRole,deficit*Math.min(1,amount || 0));
  }
  const points=Math.min(30,18*quality+6*commander+4*Math.min(1,matched.size/2)+2*neededRole*(quality>0?1:0));
  return {points:Math.round(points*10)/10,quality,families:[...matched],evidence:[...new Set(evidence)],generic:quality<0.7&&commander<0.8,neededRole};
}
export function strategicRedundancy(fn:CardFunction,value:DeckSpecificValue) {
  return value.quality>=0.7 && (fn.roles.recursion || fn.roles.sacrificeOutlets || fn.roles.ramp && fn.facts.faces.some(f=>f.triggers.some(t=>/enters/i.test(t))) || fn.engines.tokenMultipliers.any || capabilitiesFromFunction(fn));
}
const capabilitiesFromFunction=(fn:CardFunction)=>fn.conditions?.some(c=>c.understood&&c.factor>=0.7&&/counters|reuse|attach|animate/.test(c.key));
