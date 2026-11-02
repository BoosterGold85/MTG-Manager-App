import {constructedCandidates,compareConstructed} from "./engine";
import type {CollectionState} from "../models/collection";
import type {Deck} from "../models/deck";
export type StandardRequest={id:number;revision:string;state:CollectionState;deck:Deck;comparison?:{itemId:string;cutId:string;quantity:number}};
self.onmessage=({data:r}:MessageEvent<StandardRequest>)=>{
 try{self.postMessage({id:r.id,revision:r.revision,result:r.comparison?compareConstructed(r.state,r.deck,r.comparison.itemId,r.comparison.cutId,r.comparison.quantity):constructedCandidates(r.state,r.deck)});}
 catch(e){self.postMessage({id:r.id,revision:r.revision,error:e instanceof Error?e.message:"Could not analyze this change. Retry."});}
};
