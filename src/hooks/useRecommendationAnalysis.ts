import { useEffect, useState } from "react";
import type { CollectionState } from "../models/collection";
import type { Deck } from "../models/deck";
import { RecommendationClient } from "../workers/recommendationClient";
import type { AnalysisResult } from "../workers/recommendationProtocol";
import { RULESET_VERSION } from "../intelligence/types";
import { RANKING_VERSION } from "../synergy/deckSpecific";
const cache=new WeakMap<CollectionState,Map<string,AnalysisResult>>();
export function useRecommendationAnalysis(state:CollectionState,deck:Deck,mode:""|"build"|"improve"){
 const context=`${deck.id}:${mode}`;
 const revision=JSON.stringify([context,state.revision,deck,RULESET_VERSION,RANKING_VERSION]);
 const [settled,setSettled]=useState<{revision:string;context:string;attempt:number;result?:AnalysisResult;error?:string}>();
 const [attempt,setAttempt]=useState(0);
 const cached=cache.get(state)?.get(revision);
 useEffect(()=>{
  if(!mode || cache.get(state)?.has(revision))return;
  const client=new RecommendationClient();let active=true;
  client.run({revision,semanticVersion:RULESET_VERSION,rankingVersion:RANKING_VERSION,state,deck,mode,includeRelationships:true}).then(result=>{
   if(!active)return;
   let entries=cache.get(state);if(!entries)cache.set(state,entries=new Map());
   entries.set(revision,result);if(entries.size>8)entries.delete(entries.keys().next().value!);
   setSettled({revision,context,attempt,result});
  }).catch(error=>{
   if(active && error.name!=="AbortError")setSettled(previous=>({revision,context,attempt,error:error.message,result:previous?.context===context?previous.result:undefined}));
  });
  return()=>{active=false;client.cancel();};
 },[state,deck,mode,revision,context,attempt]);
 const error=settled?.revision===revision&&settled.attempt===attempt?settled.error:undefined;
 // A previous result is only visible within the same deck and goal, explicitly updating and non-actionable.
 const result=cached || (settled?.context===context?settled.result:undefined);
 return {result,error,stale:!!mode&&!cached,pending:!!mode&&!cached&&!error,retry:()=>setAttempt(n=>n+1)};
}
