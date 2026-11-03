import type { CollectionState } from '../models/collection';
import type { Deck } from '../models/deck';
import type { CardMetadata } from '../models/collection';
import type { RecommendationData } from '../synergy/recommendation';
import {cardIdentity} from '../intelligence/tagger';
import { candidateScorer, deckDnaCache, deckDnaInput } from '../dna/engine';

export interface InteractionExplanation { partner: string; evidence: string }
/** Presentation only: never reads prose to infer a relationship. */
export function selectInteractions(rec: RecommendationData | undefined, surviving: Set<string>, removedNames: string[]=[]): InteractionExplanation[] {
 const rows:InteractionExplanation[]=[];
 for(const link of [...(rec?.links || [])].sort((a,b)=>Number(b.commander)-Number(a.commander)||b.strength-a.strength||a.name.localeCompare(b.name,'en'))){
  if(!surviving.has(link.identity)||link.strength<0.5)continue;
  const namedCommanderEvidence=link.commander && rec?.facts?.name ? (rec.commander.evidence || []).filter(e=>e.includes(link.name)&&e.includes(rec.facts.name)) : [];
  for(const evidence of [...namedCommanderEvidence,...(link.evidence || [])]){
   if(!evidence.trim() || removedNames.some(name=>evidence.includes(name)) || rows.some(r=>r.partner===link.name&&r.evidence===evidence))continue;
   rows.push({partner:link.name,evidence});break;
  }
 }
 return rows.slice(0,3);
}
/** A disposable post-cut view, never saved and never used to select/rank a swap. */
export function swapInteractions(state:CollectionState,deck:Deck,candidate:CardMetadata,cutIdentity:string):InteractionExplanation[]{
 const input=deckDnaInput(state,deck);
 let remaining=1;
 // Normalize the analysis view to conceptual entries, including legacy assignment-only decks.
 const entries=input.cards.filter(c=>!c.commander).map((c,i)=>{
  const remove=c.identity===cutIdentity?Math.min(remaining,c.quantity):0;remaining-=remove;
  return {id:`explanation-${i}`,board:'main' as const,quantity:c.quantity-remove,name:c.card.name,cardIdentity:c.identity,scryfallId:c.card.scryfallId};
 }).filter(e=>e.quantity>0);
 if(remaining)return [];
 entries.push({id:"explanation-incoming",board:"main",quantity:1,name:candidate.name,cardIdentity:cardIdentity(candidate),scryfallId:candidate.scryfallId});
 const view:Deck={...deck,entries};
 const disposable:CollectionState={...state,metadata:{...state.metadata,[candidate.scryfallId]:candidate},decks:state.decks?.map(d=>d.id===deck.id?view:d)};
 const dna=deckDnaCache.get(disposable,view);
 const rec=candidateScorer(disposable,view,dna)(candidate).recommendation;
 const surviving=new Set(deckDnaInput(disposable,view).cards.map(c=>c.identity));
 return selectInteractions(rec,surviving,input.cards.filter(c=>!surviving.has(c.identity)).map(c=>c.card.name));
}
