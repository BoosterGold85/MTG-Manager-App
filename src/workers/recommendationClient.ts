import type { AnalysisRequest, AnalysisResponse, AnalysisResult } from "./recommendationProtocol";
export interface AnalysisWorker {
 onmessage:((event:MessageEvent<AnalysisResponse>)=>void)|null;
 onerror:((event:ErrorEvent)=>void)|null;
 postMessage(request:AnalysisRequest):void;
 terminate():void;
}
/** One active request per workspace. Terminating superseded workers also cancels CPU work.
 * Request ID and revision checks still reject late queued responses after termination.
 */
export class RecommendationClient {
 private serial=0;
 private worker:AnalysisWorker|null=null;
 private reject:((error:Error)=>void)|null=null;
 constructor(private create:()=>AnalysisWorker=()=>new Worker(new URL("./recommendation.worker.ts",import.meta.url),{type:"module"})){}
 cancel(){
  this.serial++;
  this.worker?.terminate();this.worker=null;
  this.reject?.(new DOMException("Analysis superseded","AbortError"));this.reject=null;
 }
 run(input:Omit<AnalysisRequest,"id">):Promise<AnalysisResult>{
  this.cancel();const id=this.serial;
  return new Promise((resolve,reject)=>{
   this.reject=reject;
   try{
    const worker=this.create();this.worker=worker;
    const finish=()=>{worker.terminate();if(this.worker===worker){this.worker=null;this.reject=null;}};
    worker.onmessage=({data})=>{
     if(id!==this.serial || data.id!==id || data.revision!==input.revision)return;
     finish();if("error"in data)reject(new Error(data.error));else resolve(data.result);
    };
    worker.onerror=()=>{if(id!==this.serial)return;finish();reject(new Error("MTG Manager could not finish this analysis. Retry or reload the app."));};
    worker.postMessage({...input,id});
   }catch{this.worker?.terminate();this.worker=null;this.reject=null;reject(new Error("MTG Manager could not start analysis. Retry or reload the app."));}
  });
 }
}
