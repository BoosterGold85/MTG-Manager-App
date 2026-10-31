import type { CardMetadata } from '../models/collection';
import type { CreatureTypeSignals, Hit } from './types';
import { creatureTypePatterns } from './subtypes';
export function creatureTypeSignals(card:CardMetadata): CreatureTypeSignals {
 const faces=card.cardFaces?.length ? card.cardFaces : [{name:card.name,typeLine:card.typeLine,oracleText:card.oracleText}];
 const own=new Set<string>(), referenced=new Set<string>(), synergy=new Set<string>();
 for(const face of faces) {
  const subtypes=/\bCreature\b/.test(face.typeLine || '') ? (face.typeLine?.split('—')[1] || '') : '';
  const text=(face.oracleText || '').replace(/[’‘]/g,"'");
  for(const {type,reference,payoff} of creatureTypePatterns) {
   if(reference.test(subtypes)) own.add(type);
   if(!reference.test(text)) continue;
   referenced.add(type);
   // A recognized creature type is necessary but not sufficient: demand a payoff/enabler.
   // Token creation alone records a reference, not a typal strategy.
   if(payoff.test(text)) synergy.add(type);
  }
 }
 return {own:[...own].sort(),referenced:[...referenced].sort(),synergy:[...synergy].sort()};
}
export function typalHits(card:CardMetadata, signals=creatureTypeSignals(card)): Hit[] {
 return signals.synergy.flatMap(type=>[
  {tagId:`typal:${type}`,snippet:card.oracleText?.slice(0,180)||card.name,reason:`An ability explicitly rewards or enables ${type} creatures.`,source:'derived' as const,confidence:0.95},
  {tagId:'typal',snippet:type,reason:'Explicit creature-type payoff/enabler, not merely a creature subtype.',source:'derived' as const,confidence:0.95},
 ]);
}
