import catalog from './data/creatureTypes.json' with {type:'json'};
const irregular:Record<string,string>={Elf:'Elves',Dwarf:'Dwarves',Wolf:'Wolves',Werewolf:'Werewolves',Mouse:'Mice',Ox:'Oxen',Fungus:'Fungi'};
export const pluralCreatureType=(type:string)=>irregular[type] || (/s$/.test(type)?type:`${type}s`);
const canonical=new Map(catalog.types.map(type=>[type.toLowerCase(),type]));
export function canonicalCreatureType(value:string) {return canonical.get(value.toLowerCase());}
const escape=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export const creatureTypePatterns=catalog.types.map(type=>{
 const forms=[type,pluralCreatureType(type)].map(escape).join('|');
 return {type,wideCount:new RegExp(`(?:control|have) (?:three|four|five|six|seven|eight|nine|ten|[3-9]|[1-9]\\d+) or more (?:${forms})\\b`,'i'),reference:new RegExp(`\\b(?:${forms})\\b`,'i'),
  payoff:new RegExp(`(?:${forms}) (?:creatures? |creature cards? )?(?:you control|in your graveyard|spells? you cast)[^.\\n]{0,75}(?:get|have|gain|cost)|(?:whenever|when)[^.\\n]{0,65}(?:${forms})[^.\\n]{0,75}(?:enters?|entered|dies?|attacks?|spell)|(?:for each|number of|if|control)[^.\\n]{0,45}(?:${forms})(?: (?:cards?|creatures?))?\\b|search[^.\\n]{0,70}(?:${forms}) (?:card|creature)|cast[^.\\n]{0,45}(?:${forms}) (?:spell|card)`,'i')};
});
