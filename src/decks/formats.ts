import type { Deck, DeckFormat } from "../models/deck";
import type { CardMetadata, CollectionState } from "../models/collection";
import { normalizedName } from "../import/csv";
export const formatOf=(deck:Pick<Deck,"format">):DeckFormat=>deck.format || "commander";
export const formatLabel=(deck:Pick<Deck,"format">)=>({commander:"Commander",standard:"Standard",legacy:"Legacy"})[formatOf(deck)];
export const targetSize=(deck:Pick<Deck,"format">)=>formatOf(deck)==="commander"?100:60;
export function copyLimit(card:CardMetadata,format:DeckFormat){
 if(/\bBasic\b/.test((card.cardFaces?.[0]?.typeLine || card.typeLine).split("—")[0]))return Infinity;
 const text=card.oracleText || "";
 if(/a deck can have any number of cards named/i.test(text))return Infinity;
 const count=text.match(/a deck can have up to (\w+|\d+) cards named/i)?.[1]?.toLowerCase();
 if(count){const value=Number(count)||({one:1,two:2,three:3,four:4,five:5,six:6,seven:7,nine:9} as Record<string,number>)[count];if(value)return value;}
 return format==="commander"?1:4;
}
/** Warnings do not fabricate legality from card colors, set code or ownership. */
export function formatWarnings(state:CollectionState,deck:Deck):string[]{
 const format=formatOf(deck);if(format==="commander")return [];
 const warnings:string[]=[];
 const main=(deck.entries || []).filter(e=>e.board==="main").reduce((n,e)=>n+e.quantity,0);
 const side=(deck.entries || []).filter(e=>e.board==="sideboard").reduce((n,e)=>n+e.quantity,0);
 if(main<60)warnings.push(`Main deck has ${main} cards; ${formatLabel(deck)} requires at least 60.`);
 if(side>15)warnings.push(`Sideboard has ${side} cards; the maximum is 15.`);
 const counts=new Map<string,{card:CardMetadata;quantity:number}>();
 let missing=0;
 for(const entry of deck.entries || []){
  const card=state.metadata[entry.scryfallId];if(!card){missing++;continue;}
  // Split/DFC printings share the canonical name/Oracle identity, across both boards and all printings.
  const key=normalizedName(card.name),old=counts.get(key);
  counts.set(key,{card,quantity:(old?.quantity || 0)+entry.quantity});
 }
 let unknown=0,stale=0;
 for(const {card,quantity}of counts.values()){
  const limit=copyLimit(card,format);
  if(quantity>limit)warnings.push(`${card.name}: ${quantity} copies across main deck and sideboard; limit ${limit}.`);
  if(card.legalities && (!card.legalityCheckedAt || !Number.isFinite(Date.parse(card.legalityCheckedAt)) || Date.now()-Date.parse(card.legalityCheckedAt)>7*86400000))stale++;
  const legality=card.legalities?.[format];
  if(!legality)unknown++;
  else if(legality!=="legal")warnings.push(`${card.name}: ${legality.replaceAll("_"," ")} in ${formatLabel(deck)} according to saved Scryfall data.`);
 }
 if(stale)warnings.push(`${stale} distinct cards have legality data older than seven days or an unknown check date. Run Check format legality for current ${format==="legacy"?"ban/eligibility":"rotation/ban"} data.`);
 if(missing)warnings.push(`Legality is unverified for ${missing} decklist entries with unresolved metadata. Missing data is not a legal-card result.`);
 if(unknown)warnings.push(`Legality is unverified for ${unknown} distinct cards: saved metadata has no ${formatLabel(deck)} legality. Import fresh canonical data before relying on this check.`);
 return warnings;
}
