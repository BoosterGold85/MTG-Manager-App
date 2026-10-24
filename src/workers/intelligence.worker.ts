import { processCards } from '../intelligence/process';
import type { CardMetadata } from '../models/collection';
import type { IntelligenceState } from '../intelligence/types';
self.onmessage=async(event:MessageEvent<{cards:CardMetadata[];previous:IntelligenceState;force:boolean}>)=>{
 try { const result=await processCards(event.data.cards,event.data.previous,event.data.force,(done,total)=>self.postMessage({progress:{done,total}})); self.postMessage({result}); }
 catch(error) {self.postMessage({error:error instanceof Error?error.message:'Could not analyze cards.'});}
};
