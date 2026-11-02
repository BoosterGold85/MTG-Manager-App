// Standard-only experimental heuristics. Shared Oracle facts are read-only;
// no Commander profile, recommendation scorer or weight is called or changed.
import type { CardMetadata, CollectionState } from "../models/collection";
import type { Deck } from "../models/deck";
import { deckCardFunction } from "../upgrades/cardFunction";
import type { Need } from "../upgrades/cardFunction";
import { needLabels } from "../upgrades/cardFunction";
import { SupplyIndex, effectConditions } from "../upgrades/conditions";
import { capabilityRelationship } from "../synergy/capabilities";
import { copyLimit, formatOf } from "../decks/formats";
import { normalizedName } from "../import/csv";
import { deckPlayable,deckUsage } from "../decks/decks";
export const STANDARD_VERSION="0.1.0";
export const key=(c:CardMetadata)=>normalizedName(c.name);
export function freshStandard(card:CardMetadata,now=Date.now()){
 const age=now-Date.parse(card.legalityCheckedAt || "");
 return card.legalities?.standard==="legal" && Number.isFinite(age) && age>=0 && age<=7*86400000;
}
export const isLand=(c:CardMetadata)=>/\bLand\b/.test(c.typeLine) || !!c.cardFaces?.some(f=>/\bLand\b/.test(f.typeLine || ""));
type Row={card:CardMetadata;quantity:number};
function main(state:CollectionState,deck:Deck):Row[]{return (deck.entries || []).filter(e=>e.board==="main").map(e=>({card:state.metadata[e.scryfallId],quantity:e.quantity}));}
export function countCard(state:CollectionState,deck:Deck,card:CardMetadata){return (deck.entries || []).filter(e=>key(state.metadata[e.scryfallId])===key(card)).reduce((n,e)=>n+e.quantity,0);}
function context(rows:Row[]){
 const supply=new SupplyIndex(rows.map(r=>({...r,commander:false})));
 const nonlands=rows.filter(r=>!isLand(r.card));
 const colors=new Set(rows.filter(r=>isLand(r.card)).flatMap(r=>[...(r.card.producedMana || r.card.colorIdentity),...(/\bSnow\b/.test(r.card.typeLine)?["S"]:[])]));
 return {supply,nonlands,colors};
}
function fit(card:CardMetadata,rows:Row[],ctx=context(rows)){
 const fn=deckCardFunction(card,ctx.supply),reasons:string[]=[],risks:string[]=[];
 let links=0,eligible=0;
 for(const other of ctx.nonlands){
  if(key(other.card)===key(card))continue;
  const evidence=[...capabilityRelationship(card,other.card),...capabilityRelationship(other.card,card)];
  const conditions=effectConditions(other.card).filter(c=>c.understood&&c.supplies(card));
  const relevant=evidence.length>0 || conditions.length>0;
  eligible+=Math.min(4,other.quantity);
  if(relevant){links+=Math.min(4,other.quantity);if(reasons.length<4)reasons.push(evidence[0] || `${card.name} supplies ${conditions[0].needs} for ${other.card.name} (${other.quantity} copies).`);}
 }
 const supported=(fn.conditions || []).filter(c=>c.understood&&c.factor>=0.5);
 for(const c of supported.slice(0,2))reasons.push(`${c.needs}: supported by ${c.suppliers.slice(0,3).join(", ")}.`);
 const density=links/Math.max(1,eligible);
 const quality=Math.min(1,density*2+supported.reduce((n,c)=>n+c.factor,0)/4);
 const roleCount=Object.values(fn.roles).filter(v=>v&&v>0).length;
 const missingColors=(card.manaCost?.match(/\{[^}]+\}/g) || []).filter(symbol=>{
   const options=symbol.slice(1,-1).split("/");
   if(options.some(o=>/^\d+$/.test(o)||o==="P"))return false;
   const colored=options.filter(o=>/^[WUBRGCS]$/.test(o));
   return colored.length>0&&!colored.some(c=>ctx.colors.has(c));
 });
 if(missingColors.length)risks.push(`Saved lands do not show ${missingColors.join("/")} mana support; a mana-base change may be needed.`);
 const text=card.oracleText || "";
 const severe=/(?:exile your library|exile all cards from your library|you lose the game|skip your next turn|you skip your draw step|you can't cast spells|discard your hand)/i.test(text);
 if(severe)risks.push("A potentially severe resource or loss effect is present. This model cannot validate a mitigation/combo; do not treat it as an upgrade.");
 const curve=ctx.nonlands.reduce((n,r)=>n+r.quantity*r.card.manaValue,0)/Math.max(1,ctx.nonlands.reduce((n,r)=>n+r.quantity,0));
 const curvePenalty=Math.max(0,card.manaValue-curve-1)*3;
 const score=Math.max(0,Math.min(severe?15:100,Math.round(quality*65+Math.min(15,roleCount*5)+10-curvePenalty-missingColors.length*15)));
 const brew=Math.max(0,Math.min(severe?10:100,Math.round(quality*85+(key(card)&&rows.some(r=>key(r.card)===key(card))?0:5)-missingColors.length*15)));
 if(!reasons.length)reasons.push("No specific supported interaction was identified; general utility alone is weak evidence.");
 return {score,brew,reasons,risks,roles:fn.roles,links,severe,missingMana:missingColors.length>0};
}
function utility(rows:Row[]){
 const ctx=context(rows),roles:Partial<Record<Need,number>>={};let value=0,total=0;
 for(const row of ctx.nonlands){const f=fit(row.card,rows,ctx);value+=row.quantity*f.score;total+=row.quantity;for(const [r,n]of Object.entries(f.roles))roles[r as Need]=(roles[r as Need] || 0)+(n || 0)*row.quantity;}
 // Diminishing factual role coverage; no archetype-specific targets or Commander weights.
 const coverage=Object.entries(roles).reduce((n,[role,count])=>n+Math.sqrt(count || 0)*(["interaction","cardAdvantage","protection"].includes(role)?4:2),0);
 return {value:value/Math.max(1,total)+coverage,roles};
}
export interface StandardCandidate {itemId:string;card:CardMetadata;available:number;owned:number;inDeck:number;room:number;usedIn:string[];score:number;brew:number;reasons:string[];risks:string[];}
export function standardCandidates(state:CollectionState,deck:Deck){
 if(formatOf(deck)!=="standard")throw new Error("Standard analysis cannot analyze another format.");
 const rows=main(state,deck),ctx=context(rows),candidates:StandardCandidate[]=[];
 let unknown=0,illegal=0,riskExcluded=0,manaExcluded=0;
 for(const item of state.items){
  const card=state.metadata[item.scryfallId];if(!card || item.quantityOwned<1 || isLand(card) || !deckPlayable(card))continue;
  if(!freshStandard(card)){if(card.legalities?.standard && card.legalities.standard!=="legal")illegal++;else unknown++;continue;}
  const inDeck=countCard(state,deck,card),room=copyLimit(card,"standard")-inDeck;
  if(room<=0)continue;
  const value=fit(card,rows,ctx);
  if(value.severe){riskExcluded++;continue;}
  if(value.missingMana){manaExcluded++;continue;}
  candidates.push({itemId:item.id,card,available:item.quantityUnassigned,owned:item.quantityOwned,inDeck,room,usedIn:deckUsage(state,item.id).map(u=>`${u.deck.name} (${u.quantity})`),...value});
 }
 candidates.sort((a,b)=>Number(b.available>0)-Number(a.available>0)||b.score-a.score||b.brew-a.brew||a.card.name.localeCompare(b.card.name)||a.itemId.localeCompare(b.itemId));
 return {candidates,unknown,illegal,riskExcluded,manaExcluded,mainCount:rows.reduce((n,r)=>n+r.quantity,0)};
}
export function openingChance(total:number,copies:number){
 let none=1;for(let i=0;i<Math.min(7,total);i++)none*=Math.max(0,total-copies-i)/(total-i);
 return Math.round((1-none)*1000)/10;
}
export function compareStandard(state:CollectionState,deck:Deck,itemId:string,cutId:string,quantity:number){
 if(formatOf(deck)!=="standard")throw new Error("Standard comparison only.");
 const item=state.items.find(i=>i.id===itemId),cut=deck.entries?.find(e=>e.id===cutId&&e.board==="main");
 if(!item||!cut||!Number.isSafeInteger(quantity)||quantity<1||quantity>4||cut.quantity<quantity)throw new Error("Choose one to four copies within the selected main-deck entry.");
 const card=state.metadata[item.scryfallId],out=state.metadata[cut.scryfallId];
 if(!freshStandard(card)||isLand(card)||isLand(out)||key(card)===key(out))throw new Error("Choose a different, freshly verified legal nonland card.");
 if(countCard(state,deck,card)+quantity>copyLimit(card,"standard"))throw new Error("This change exceeds the copy limit across main deck and sideboard.");
 if(fit(card,main(state,deck)).missingMana)throw new Error("Saved lands do not show this cast cost. Adjust mana through the regular deck editor first.");
 if(fit(card,main(state,deck)).severe)throw new Error("Severe downside cannot be validated by this model. Use the regular deck editor instead.");
 const before=main(state,deck),after=before.map(r=>({...r}));
 // Match the exact entry rather than removing copies from another printing/board.
 const mainEntries=deck.entries!.filter(e=>e.board==="main"),index=mainEntries.findIndex(e=>e.id===cutId);
 after[index].quantity-=quantity;after.push({card,quantity});
 const a=utility(before),b=utility(after.filter(r=>r.quantity>0));
 const lost=Object.entries(a.roles).filter(([role,count])=>(count || 0)>0&&!(b.roles[role as Need] || 0)).map(([role])=>needLabels[role as Need]);
 const releases:{itemId:string;quantity:number;printing:string}[]=[];
 const linked=deck.assignments.filter(a=>a.entryId===cutId);
 let releasing=Math.max(0,quantity-(cut.quantity-linked.reduce((n,a)=>n+a.quantity,0)));
 for(const assignment of [...linked].reverse()){
   const released=Math.min(releasing,assignment.quantity);if(released<1)continue;
   const held=state.items.find(i=>i.id===assignment.itemId)!;const printing=state.metadata[held.scryfallId];
   releases.push({itemId:held.id,quantity:released,printing:`${printing.setCode.toUpperCase()} #${printing.collectorNumber} · ${held.finish} · ${held.language}`});releasing-=released;
 }
 const total=before.reduce((n,r)=>n+r.quantity,0),copies=before.filter(r=>key(r.card)===key(card)).reduce((n,r)=>n+r.quantity,0);
 return {releases,mainCopiesBefore:copies,mainCopiesAfter:copies+quantity,openingBefore:openingChance(total,copies),openingAfter:openingChance(total,copies+quantity),delta:Math.round((b.value-a.value)*10)/10,lost,quantity,incoming:card.name,outgoing:out.name,available:item.quantityUnassigned,canAssign:item.quantityUnassigned>=quantity,caution:"Heuristic contextual change, not predicted win rate. Mana-base changes, sideboard matchups and combos are not validated."};
}
