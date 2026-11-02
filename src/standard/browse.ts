import type {CardMetadata,CollectionState,CollectionItem} from "../models/collection";
import type {SampleCollectionCard} from "../models/card";
import type {Deck} from "../models/deck";
import {cardIdentity,effectiveAssignments} from "../intelligence/tagger";
import {formatOf} from "../decks/formats";
import {deckPlayable} from "../decks/decks";
import {isLand,key} from "./engine";
import type {StandardCandidate} from "./engine";
export interface OwnedUpgradeRow {item:CollectionItem;card:CardMetadata;candidate?:StandardCandidate;legality:"legal"|"unverified"|"not-legal";label:string;inDeck:number;notes:string[];}
export function ownedUpgradeRows(state:CollectionState,deck:Deck,analysis?:{candidates:StandardCandidate[];exclusions:Record<string,string[]>},now=Date.now()):OwnedUpgradeRow[]{
 const format=formatOf(deck),counts=new Map<string,number>(),byId=new Map((analysis?.candidates || []).map(c=>[c.itemId,c]));
 for(const entry of deck.entries || []){const c=state.metadata[entry.scryfallId];if(c)counts.set(key(c),(counts.get(key(c)) || 0)+entry.quantity);}
 return state.items.filter(i=>i.quantityOwned>0).flatMap(item=>{
  const card=state.metadata[item.scryfallId];if(!card)return [];
  const status=card.legalities?.[format],age=now-Date.parse(card.legalityCheckedAt || ""),verified=!!status&&Number.isFinite(age)&&age>=0&&age<=7*86400000;
  const legality=!verified?"unverified":status==="legal"?"legal":"not-legal";
  const candidate=legality==="legal"?byId.get(item.id):undefined;
  const notes=!deckPlayable(card)?["Not deck-playable — browse only."]:isLand(card)?["Land — browse only. Land swaps are not supported here."]:legality==="unverified"?["Legality is unverified or stale — browse only until checked."]:legality==="not-legal"?[`${status!.replaceAll("_"," ")} in ${format} — browse only.`]:analysis?.exclusions?.[item.id] || (!candidate?[analysis?"Browse only; no supported comparison is available.":"Comparison analysis is not ready. You can read this card now."]:[]);
  return [{item,card,candidate,legality,label:legality==="legal"?`${format==="legacy"?"Legacy":"Standard"} legal · saved check`:legality==="unverified"?"Legality unverified / stale":`${status!.replaceAll("_"," ")} in ${format==="legacy"?"Legacy":"Standard"}`,inDeck:counts.get(key(card)) || 0,notes} as OwnedUpgradeRow];
 });
}
export function ownedDetailCard(state:CollectionState,id:string):SampleCollectionCard|undefined{
 const item=state.items.find(i=>i.id===id);if(!item)return;
 const card=state.metadata[item.scryfallId];if(!card)return;
 const identity=cardIdentity(card),analysis=state.intelligence?.auto[identity],tagOverrides=state.intelligence?.overrides[identity];
 return {...card,id,quantity:item.quantityOwned,ownership:item,foil:item.finish!=="nonfoil",analysis,tagOverrides,intelligentTags:effectiveAssignments(analysis,tagOverrides).map(a=>a.tagId)};
}
