import type {CardMetadata} from "../models/collection";
export interface LegalityBatch {metadata:Record<string,CardMetadata>;issues:Record<string,string>;unresolved:string[];}
export interface LegalityRun extends LegalityBatch {total:number;checked:number;stopped:boolean;interrupted:boolean;failure?:unknown;}
export type LegalityLookup=(ids:string[],signal:AbortSignal)=>Promise<LegalityBatch>;
// A check is public metadata only. A transient service failure never means a card is illegal.
export async function runLegalityCheck(ids:string[],signal:AbortSignal,lookup:LegalityLookup,progress:(checked:number,total:number)=>void,previous?:LegalityRun):Promise<LegalityRun>{
 const unique=[...new Set(ids)],wanted=new Set(unique);
 const metadata=Object.fromEntries(Object.entries(previous?.metadata || {}).filter(([id])=>wanted.has(id)));
 const issues=Object.fromEntries(Object.entries(previous?.issues || {}).filter(([id])=>wanted.has(id)));
 const pending=unique.filter(id=>!metadata[id]&&!issues[id]);
 let interrupted=false,failure:unknown;
 const count=()=>Object.keys(metadata).length+Object.keys(issues).length;
 progress(count(),unique.length);
 for(let start=0;start<pending.length;start+=75){
  if(signal.aborted){interrupted=true;break;}
  const batch=pending.slice(start,start+75);
  try{
   const result=await lookup(batch,signal);
   // Never accept a result for an identifier outside this batch.
   if([...Object.keys(result.metadata),...Object.keys(result.issues)].some(id=>!batch.includes(id)))throw new Error("Unexpected legality batch");
   Object.assign(metadata,result.metadata);Object.assign(issues,result.issues);
   if(result.unresolved.length)interrupted=true;
   progress(count(),unique.length);
  }catch(error){failure=error;interrupted=true;break;}
 }
 const unresolved=unique.filter(id=>!metadata[id]&&!issues[id]);
 return {metadata,issues,unresolved,total:unique.length,checked:count(),stopped:signal.aborted,interrupted:interrupted||unresolved.length>0,failure};
}

// Explicit resume-after-reload mode: use saved statuses within the same seven-day
// browsing policy. A full check and final swap verification still bypass these.
export function savedLegalityCheckpoint(ids:string[],cards:Record<string,CardMetadata>,format:"standard"|"legacy",now=Date.now()):LegalityRun{
 const unique=[...new Set(ids)],metadata=Object.fromEntries(unique.filter(id=>{const c=cards[id],age=now-Date.parse(c?.legalityCheckedAt || "");return !!c?.legalities?.[format]&&Number.isFinite(age)&&age>=0&&age<=7*86400000;}).map(id=>[id,cards[id]]));
 const unresolved=unique.filter(id=>!metadata[id]);return {metadata,issues:{},unresolved,total:unique.length,checked:Object.keys(metadata).length,stopped:false,interrupted:false};
}
