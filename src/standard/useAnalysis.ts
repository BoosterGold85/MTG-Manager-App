import {useEffect,useState} from "react";
import type {CardMetadata,CollectionState} from "../models/collection";
import type {Deck} from "../models/deck";
import {LEGACY_VERSION} from "../legacy/brew";
import {STANDARD_VERSION} from "./engine";
import type {StandardRequest} from "./worker";
type Cached={result:unknown;expires:number};
const cache=new WeakMap<CollectionState,Map<string,Cached>>();
export function useStandardAnalysis<T>(state:CollectionState,deck:Deck,comparison?:StandardRequest["comparison"],enabled=true){
 const [attempt,setAttempt]=useState(0),[clock,setClock]=useState(0);
 const revision=JSON.stringify([state.revision,deck,STANDARD_VERSION,LEGACY_VERSION,comparison,attempt,clock]);
 const [settled,setSettled]=useState<{revision:string;result?:T;error?:string;expires:number}>();
 const entry=!comparison?cache.get(state)?.get(revision):undefined;
 const cached=entry&&entry.expires>Date.now()?entry:undefined;
 const current=settled?.revision===revision?settled:undefined;
 const ready=!!cached || !!current&&(!!current.error || current.expires>Date.now());
 const expires=entry?.expires ?? current?.expires ?? Infinity;
 // Expiration invalidates local analysis only; it never silently calls Scryfall.
 useEffect(()=>{
  if(!enabled || !Number.isFinite(expires))return;
  const timer=setTimeout(()=>setClock(n=>n+1),Math.max(1,expires-Date.now()));return()=>clearTimeout(timer);
 },[enabled,expires]);
 useEffect(()=>{
  const known=!comparison?cache.get(state)?.get(revision):undefined;
  if(!enabled || known&&known.expires>Date.now())return;
  let active=true,worker:Worker|undefined;
  Promise.resolve().then(()=>{
   if(!active)return;
   try{
    worker=new Worker(new URL("./worker.ts",import.meta.url),{type:"module"});
    worker.onmessage=({data})=>{
     if(!active||data.id!==1||data.revision!==revision)return;
     const cards:CardMetadata[]=comparison?[state.metadata[state.items.find(i=>i.id===comparison.itemId)?.scryfallId || ""]].filter(Boolean):(data.result?.candidates || []).map((c:{card:CardMetadata})=>c.card);
     const validUntil=data.error?Infinity:Math.min(Infinity,...cards.map(c=>Date.parse(c.legalityCheckedAt || "")+7*86400000+1).filter(Number.isFinite));
     if(!data.error && !comparison){let entries=cache.get(state);if(!entries)cache.set(state,entries=new Map());entries.set(revision,{result:data.result,expires:validUntil});if(entries.size>12)entries.delete(entries.keys().next().value!);}
     setSettled({revision,result:data.result,error:data.error,expires:validUntil});worker?.terminate();
    };
    worker.onerror=()=>{if(active)setSettled({revision,error:"Could not analyze this deck. Reopen Upgrades to retry.",expires:Infinity});worker?.terminate();};
    worker.postMessage({id:1,revision,state,deck,comparison} satisfies StandardRequest);
   }catch{if(active)setSettled({revision,error:"Could not start deck analysis. Reopen Upgrades or reload to retry.",expires:Infinity});worker?.terminate();}
  });
  return()=>{active=false;worker?.terminate();};
 },[state,deck,revision,comparison,enabled]);
 return {pending:enabled&&!ready,result:enabled?(cached?.result as T || (ready?current?.result:undefined)):undefined,error:enabled?current?.error:undefined,retry:()=>setAttempt(n=>n+1),revision};
}
