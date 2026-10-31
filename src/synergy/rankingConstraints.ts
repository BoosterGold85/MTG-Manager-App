// Proven scoring constraints outside the approved v0.6.15 semantic primitives.
// Canonical facts are retained; inaccessible optional portions cannot earn utility.
import type { CardMetadata } from "../models/collection";
import type { CardFacts } from "./facts";
import type { DeckStrategyProfile } from "../dna/strategy";
import { stripReminderText } from "../utils/rulesText";
function computeConstraints(card:CardMetadata,facts:CardFacts,profile:DeckStrategyProfile){
  const text=stripReminderText(card.oracleText || "").replace(/[’‘]/g,"'");
  const name=card.name.replace(/[’‘]/g,"'").replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  const cost=/exile this spell and/i.test(text)?text.match(new RegExp(`exile this spell and (one|two|three|four|five|\\d+) cards named ${name} from your graveyard`,"i")):null;
  const required=cost?({one:1,two:2,three:3,four:4,five:5} as Record<string,number>)[cost[1].toLowerCase()]||Number(cost[1]):0;
  const total=profile.cards.filter(c=>(!!card.oracleId&&c.card.card.oracleId===card.oracleId)||c.card.card.name===card.name).reduce((n,c)=>n+c.card.quantity,0);
  const unavailableTutor=!!cost&&Math.max(0,total-1)<required;
  const forcedHandLoss=facts.faces.some(f=>f.discards.some(d=>d.mode==="hand"&&d.who==="you"&&/At the beginning of your end step, discard your hand/i.test(d.text)));
  const discardPayoffs=profile.cards.filter(c=>c.card.assignments.some(a=>["discard-payoff","mayhem","madness"].includes(a.tagId))).length;
  const penalties:{name:string;points:number;reason:string}[]=[];
  if(unavailableTutor)penalties.push({name:"unavailable_optional_portion",points:12,reason:`The optional graveyard tutor requires ${required} other actual cards with this name; this list cannot supply them. Its independent primary effect remains usable.`});
  if(forcedHandLoss)penalties.push({name:"mandatory_hand_loss",points:discardPayoffs>=3?8:15,reason:"Mandatory end-step hand loss prevents retaining resources; extra draws are not free card advantage. This is not controlled discard."});
  return {unavailableTutor,forcedHandLoss,penalties};
}

const cache=new WeakMap<DeckStrategyProfile,WeakMap<CardMetadata,ReturnType<typeof computeConstraints>>>();
export function rankingConstraints(card:CardMetadata,facts:CardFacts,profile:DeckStrategyProfile){
  let cards=cache.get(profile);if(!cards)cache.set(profile,cards=new WeakMap());
  let result=cards.get(card);if(!result)cards.set(card,result=computeConstraints(card,facts,profile));return result;
}
