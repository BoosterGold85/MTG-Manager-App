import type { CardMetadata, CollectionState } from '../models/collection';
import type { IntelligenceState } from './types';
import { ownedCanonicalCards } from "./process";
import { emptyIntelligence } from './tagger';
export function tagInWorker(cards:CardMetadata[],previous:IntelligenceState=emptyIntelligence(),force=false,
 progress:(message:string)=>void=()=>{},signal?:AbortSignal):Promise<IntelligenceState> {
 signal?.throwIfAborted();
 return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('../workers/intelligence.worker.ts',import.meta.url),{type:'module'});
  const cleanup=()=>{worker.terminate();signal?.removeEventListener('abort',abort);};
  const abort=()=>{cleanup();reject(new DOMException('Tagging canceled','AbortError'));};
  signal?.addEventListener('abort',abort,{once:true});
  worker.onmessage=event=>{
   if(event.data.progress) {const {done,total}=event.data.progress;progress(`Auto-tags · ${done.toLocaleString()} of ${total.toLocaleString()} canonical cards`);}
   else if(event.data.error) {cleanup();reject(new Error(event.data.error));}
   else {cleanup();resolve(event.data.result);}
  };
  worker.onerror=()=>{cleanup();reject(new Error('Auto-tags could not finish. Reload or use Recalculate Auto-Tags to retry.'));};
  worker.postMessage({cards,previous,force});
 });
}
export async function tagCollection(state:CollectionState,progress:(message:string)=>void,signal?:AbortSignal,force=false) {
 const cards=ownedCanonicalCards(state);
 return {...state,intelligence:await tagInWorker(cards,state.intelligence,force,progress,signal)};
}
