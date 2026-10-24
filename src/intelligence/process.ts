import type { CardMetadata, CollectionState } from '../models/collection';
import type { IntelligenceState } from './types';
import { analyze, cardIdentity, emptyIntelligence, needsAnalysis } from './tagger';
export function canonicalCards(cards:CardMetadata[]) {
 const groups=new Map<string,CardMetadata>();
 const names=new Map(cards.filter(c=>c.oracleId).map(c=>[c.name.toLowerCase(),c.oracleId!]));
 for(const card of cards) {
  const normalized={...card,oracleId:card.oracleId || names.get(card.name.toLowerCase())};
  const key=cardIdentity(normalized); const previous=groups.get(key);
  if(!previous || (!previous.cardFaces?.length && normalized.cardFaces?.length) || (!previous.oracleText && normalized.oracleText)) groups.set(key,normalized);
 }
 return [...groups.values()];
}
export function ownedCanonicalCards(state:CollectionState) {
 const oracleByName=new Map(Object.values(state.metadata).filter(c=>c.oracleId).map(c=>[c.name.toLowerCase(),c.oracleId!]));
 const cards=[...new Set(state.items.map(item=>item.scryfallId))].map(id=>state.metadata[id]).filter(Boolean).map(card=>({...card,oracleId:card.oracleId || oracleByName.get(card.name.toLowerCase())}));
 return canonicalCards(cards);
}
export async function processCards(cards:CardMetadata[], previous:IntelligenceState=emptyIntelligence(), force=false,
 progress:(done:number,total:number)=>void=()=>{}, signal?:AbortSignal):Promise<IntelligenceState> {
 const unique=canonicalCards(cards); const next={auto:{...previous.auto},overrides:{...previous.overrides}};
 // Migrate name-keyed results and corrections when richer Oracle IDs become available.
 for(const card of unique) {
  const nameKey=cardIdentity({...card,oracleId:undefined}); const key=cardIdentity(card);
  if(key!==nameKey && previous.overrides[nameKey]) {
   const existing=next.overrides[key]; const older=previous.overrides[nameKey];
   const added=[...new Set([...older.added,...(existing?.added||[])])].filter(id=>!existing?.suppressed.includes(id));
   const suppressed=[...new Set([...older.suppressed,...(existing?.suppressed||[])])].filter(id=>!added.includes(id));
   next.overrides[key]={added,suppressed,...(older.assignments || existing?.assignments ? {assignments:[...(older.assignments||[]),...(existing?.assignments||[])].filter(a=>added.includes(a.tagId)||suppressed.includes(a.tagId)).map(a=>({...a,cardIdentity:key}))}: {})};
   delete next.overrides[nameKey];
  }
 }
 const pending=unique.filter(card=>force || needsAnalysis(card,next.auto[cardIdentity(card)]));
 progress(0,pending.length);
 for(let offset=0;offset<pending.length;offset+=40) {
  signal?.throwIfAborted();
  for(const card of pending.slice(offset,offset+40)) next.auto[cardIdentity(card)]=analyze(card);
  progress(Math.min(offset+40,pending.length),pending.length);
  await new Promise(resolve=>setTimeout(resolve,0));
 }
 return next;
}
