import type { CardMetadata } from '../models/collection';
import type { CreatureTypeSignals, Hit } from './types';
const common = ['Elf','Elves','Goblin','Zombie','Dragon','Human','Merfolk','Vampire','Wizard','Warrior','Soldier','Beast','Dinosaur','Angel','Demon','Spirit','Rogue','Cleric','Shaman','Druid','Knight','Sliver','Ally','Cat','Dog','Rat','Bird','Faerie','Fungus','Saproling','Treefolk','Elemental','Eldrazi','Orc','Dwarf','Dwarves','Wurm','Hydra','Pirate','Samurai','Ninja','Werewolf','Wolf','Wolves','Vampire','Changeling'];
const singular = (value:string) => ({Elves:'Elf',Dwarves:'Dwarf',Wolves:'Wolf'}[value] || value.replace(/s$/, ''));
export function creatureTypeSignals(card:CardMetadata): CreatureTypeSignals {
 const faces=card.cardFaces?.length ? card.cardFaces : [{name:card.name,typeLine:card.typeLine,oracleText:card.oracleText}];
 const own=new Set<string>(), referenced=new Set<string>(), synergy=new Set<string>();
 for(const face of faces) {
  if(/\bCreature\b/.test(face.typeLine || '')) for(const type of (face.typeLine?.split('—')[1] || '').trim().split(/\s+/)) if(type) own.add(type);
  const text=face.oracleText || '';
  const candidates=new Set([...common,...own,...Array.from(text.matchAll(/\b([A-Z][a-z]+)s? (?:creatures? )?(?:you control|spells? you cast)/g),m=>m[1])]);
  for(const candidate of candidates) {
   const type=singular(candidate); const escaped=candidate.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
   if(!new RegExp(`\\b${escaped}s?\\b`).test(text)) continue;
   referenced.add(type);
   const pattern=new RegExp(`(?:other |each |for each |number of )?${escaped}s? (?:creatures? )?(?:you control|spells? you cast)[^.\\n]{0,75}(?:get|have|gain|cost)|(?:whenever|when)[^.\\n]{0,80}${escaped}s?[^.\\n]{0,75}(?:enters?|dies?|attacks?|spell)|search[^.\\n]{0,90}${escaped} (?:card|creature)|(?:reveal|cast)[^.\\n]{0,55}${escaped} (?:spell|card)`, 'i');
   if(pattern.test(text)) synergy.add(type);
  }
 }
 return {own:[...own].sort(),referenced:[...referenced].sort(),synergy:[...synergy].sort()};
}
export function typalHits(card:CardMetadata): Hit[] {
 return creatureTypeSignals(card).synergy.flatMap(type=>[
  {tagId:`typal:${type}`,snippet:card.oracleText?.slice(0,180)||card.name,reason:`An ability explicitly rewards or enables ${type} creatures.`,source:'derived' as const,confidence:0.95},
  {tagId:'typal',snippet:type,reason:'Explicit creature-type payoff/enabler, not merely a creature subtype.',source:'derived' as const,confidence:0.95},
 ]);
}
