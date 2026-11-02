// Legacy-only exploration lens. Existing Commander facts are read, never retuned.
import type {CardMetadata} from "../models/collection";
import {capabilityRelationship} from "../synergy/capabilities";
import {deckCardFunction} from "../upgrades/cardFunction";
import {conditionFactor,effectConditions,SupplyIndex} from "../upgrades/conditions";
import {normalizedName} from "../import/csv";
export const LEGACY_VERSION="0.1.0";
type Row={card:CardMetadata;quantity:number};
export interface LegacyBrew {score:number;interesting:boolean;label:string;reasons:string[];anchors:string[];mechanisms:string[];novel:boolean;}
// Categorize only recipient-verified relationship evidence, not shared tags/words.
function channel(evidence:string){
 if(/^(Exile and return reuses|Friendly bounce)/.test(evidence))return "Entry reuse";
 if(/^Copies /.test(evidence))return "Independent copies";
 if(/^Attaches /.test(evidence))return "Attachments";
 if(/^Enables /.test(evidence))return "Vehicle support";
 if(/^After \d+ spell casts/.test(evidence))return "Spell copying";
 if(/^Actual artifact sacrifices/.test(evidence))return "Artifact sacrifice";
 if(/^An untapped /.test(evidence))return "Artifact tap costs";
 if(/^Amplifies the actual counter/.test(evidence))return "Counter interactions";
 if(/^Can replay lands/.test(evidence))return "Graveyard land reuse";
 return "Verified interaction";
}
function conditionChannel(key:string){
 if(key==="reuse:entry")return "Entry reuse";
 const kind=key.split(":")[0];
 const labels:Record<string,string>={cast:"Spell casts","transform-cast":"Spell copying","named-copies":"Independent copies",counters:"Counter interactions",tap:"Artifact tap costs",attach:"Attachments",animate:"Vehicle support",crew:"Vehicle support"};
 return labels[kind] || `Condition: ${kind}`;
}
const norm=(c:CardMetadata)=>normalizedName(c.name);
function signature(card:CardMetadata,others:Row[],supply:SupplyIndex){
 const channels=new Set<string>();
 for(const row of others){if(norm(row.card)===norm(card))continue;for(const evidence of capabilityRelationship(card,row.card))channels.add(channel(evidence));}
 for(const c of deckCardFunction(card,supply).conditions || [])if(c.understood&&c.factor>=0.5&&!(c.key==="reuse:entry"&&channels.has("Independent copies")))channels.add(conditionChannel(c.key));
 return channels;
}
const priorSignatures=new WeakMap<SupplyIndex,Set<string>[]>();
export function legacyBrew(card:CardMetadata,rows:Row[],supply:SupplyIndex):LegacyBrew{
 const unique=new Map<string,Row>();for(const r of rows){if(r.quantity<1||norm(r.card)===norm(card))continue;const old=unique.get(norm(r.card));unique.set(norm(r.card),{card:r.card,quantity:Math.min(4,(old?.quantity || 0)+r.quantity)});}
 const partners=new Map<string,{name:string;copies:number;evidence:string[]}>(),channels=new Map<string,Set<string>>();
 const add=(row:Row,mechanism:string,evidence:string)=>{
  const id=norm(row.card),partner=partners.get(id) || {name:row.card.name,copies:row.quantity,evidence:[]};
  if(!partner.evidence.includes(evidence))partner.evidence.push(evidence);partners.set(id,partner);
  const members=channels.get(mechanism) || new Set<string>();members.add(id);channels.set(mechanism,members);
 };
 const supported=deckCardFunction(card,supply).conditions?.filter(c=>c.understood&&c.factor>=0.5) || [];
 for(const row of unique.values()){
  for(const evidence of [...capabilityRelationship(card,row.card),...capabilityRelationship(row.card,card)])add(row,channel(evidence),evidence.split(": ")[0]);
  for(const c of supported)if(c.suppliers.includes(row.card.name)&&!(c.key==="reuse:entry"&&channels.get("Independent copies")?.has(norm(row.card))))add(row,conditionChannel(c.key),`${row.card.name} supplies ${c.needs} (${row.quantity} main-deck copies).`);
  // One additional candidate copy must actually help a sufficiently supplied condition.
  for(const c of effectConditions(row.card))if(c.understood&&c.supplies(card)&&conditionFactor(c,supply.supply(c).supply+1)>=0.5)add(row,conditionChannel(c.key),`${card.name} feeds ${row.card.name}'s ${c.needs} ability; existing main-deck supply plus one copy meets the modeled support threshold.`);
 }
 const anchors=[...partners.values()].map(p=>p.name).sort(),mechanisms=[...channels.keys()].sort();
 if(!anchors.length)return {score:0,interesting:false,label:"No verified brew",reasons:["No supported main-deck interaction was identified. A new name or generic utility alone earns no Brew Score."],anchors,mechanisms,novel:false};
 const own=signature(card,rows,supply);
 const alreadyMain=rows.some(r=>r.quantity>0&&norm(r.card)===norm(card));
 let prior=priorSignatures.get(supply);
 if(!prior){prior=rows.map(r=>signature(r.card,rows,supply));priorSignatures.set(supply,prior);}
 const novel=!alreadyMain&&own.size>0&&!prior.some(other=>[...own].every(c=>other.has(c)));
 const groups=[...channels.values()];
 const bridge=groups.some((a,i)=>groups.some((b,j)=>i!==j&&[...a].some(x=>[...b].some(y=>x!==y))));
 const reuse=[...partners.values()].some(p=>p.evidence.some(e=>/^(Exile and return reuses|Friendly bounce|Copies |After \d+ spell casts|Amplifies the actual counter|Can replay lands)/.test(e)));
 const copies=[...partners.values()].reduce((n,p)=>n+p.copies,0);
 const score=Math.min(100,Math.round(Math.min(50,anchors.length*12+Math.min(8,copies))+(bridge?20:0)+(reuse?15:0)+(novel?10:0)+(supported.length?5:0)));
 const interesting=score>=55&&novel&&(anchors.length>=2||bridge);
 const reasons=[...partners.values()].slice(0,4).map(p=>`${p.name} ×${p.copies}: ${p.evidence[0]}`);
 if(bridge)reasons.push(`Connects different supported mechanisms (${mechanisms.join(", ")}) with distinct main-deck partners.`);
 if(novel)reasons.push("Adds a supported mechanism combination not already supplied by one main-deck card; this is local deck novelty, not global rarity.");
 if(reuse)reasons.push("Reuses or amplifies an actual effect here. Costs, timing, interaction and infinite loops are not proven.");
 if(alreadyMain)reasons.push("Already in the main deck: extra copies can improve consistency, but earn no novelty bonus.");
 return {score,interesting,label:interesting?"Interesting Brew":score>=35?"Supported interaction":"Tentative interaction",reasons,anchors,mechanisms,novel};
}
