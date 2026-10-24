import type { SampleCollectionCard } from '../models/card';
// Canonical named mechanics are metadata, separate from strategic tag assignments.
export function cardKeywords(card:Pick<SampleCollectionCard,'keywords'|'cardFaces'>) {
 const unique=new Map<string,string>();
 for(const value of [...(card.keywords||[]),...(card.cardFaces||[]).flatMap(face=>face.keywords||[])]) {
  const keyword=value.trim();if(keyword) unique.set(keyword.toLowerCase(),keyword);
 }
 return [...unique.values()].sort((a,b)=>a.localeCompare(b));
}
export function collectionKeywords(cards:SampleCollectionCard[]) {
 const unique=new Map<string,string>();for(const card of cards) for(const word of cardKeywords(card)) unique.set(word.toLowerCase(),word);
 return [...unique.values()].sort((a,b)=>a.localeCompare(b));
}
export function oracleText(card:Pick<SampleCollectionCard,'oracleText'|'cardFaces'>) {
 return [card.oracleText,...(card.cardFaces||[]).map(face=>face.oracleText)].filter(Boolean).join('\n');
}
