import { expect, it } from "vitest";
import { RecommendationClient } from "../../src/workers/recommendationClient";
import type { AnalysisWorker } from "../../src/workers/recommendationClient";
import { computeRecommendations } from "../../src/workers/recommendationProtocol";
import type { AnalysisRequest, AnalysisResult } from "../../src/workers/recommendationProtocol";
import { RULESET_VERSION } from "../../src/intelligence/types";
import { RANKING_VERSION } from "../../src/synergy/deckSpecific";
import { synergyFixture } from "../synergyFixtures";
import { buildAroundCommander, brewCandidates } from "../../src/upgrades";
const request=():Omit<AnalysisRequest,"id">=>{
 const f=synergyFixture();
 return {revision:"deck-v1",semanticVersion:RULESET_VERSION,rankingVersion:RANKING_VERSION,mode:"build",includeRelationships:true,state:f.state,deck:f.deck};
};
class FakeWorker implements AnalysisWorker {
 onmessage:AnalysisWorker["onmessage"]=null;
 onerror:AnalysisWorker["onerror"]=null;
 request?:AnalysisRequest;
 terminated=false;
 postMessage(request:AnalysisRequest){this.request=request;}
 terminate(){this.terminated=true;}
 respond(result:AnalysisResult,revision=this.request!.revision){this.onmessage?.({data:{id:this.request!.id,revision,result}} as MessageEvent);}
}
it("worker computation preserves deterministic rankings, structured-clones results and writes no saved data",()=>{
 const input=request(),before=JSON.stringify(input);
 const result=computeRecommendations({...input,id:1});
 expect(result.candidates).toEqual(buildAroundCommander(input.state,input.deck));
 expect(result.relationships).toEqual(brewCandidates(input.state,input.deck));
 expect(structuredClone(result)).toEqual(result);
 expect(JSON.stringify(input)).toBe(before);
 expect(()=>computeRecommendations({...input,id:2,rankingVersion:"obsolete"})).toThrow("version mismatch");
});
it("superseding a request terminates work and rejects late responses and wrong revisions",async()=>{
 const workers:FakeWorker[]=[];
 const client=new RecommendationClient(()=>{const w=new FakeWorker();workers.push(w);return w;});
 const input=request(),result=computeRecommendations({...input,id:0});
 const first=client.run(input).catch(e=>e.name);
 let complete=false;
 const second=client.run({...input,revision:"deck-v2"}).then(r=>{complete=true;return r;});
 expect(await first).toBe("AbortError");expect(workers[0].terminated).toBe(true);
 workers[0].respond(result);workers[1].respond(result,"deck-v1");
 await Promise.resolve();expect(complete).toBe(false);
 workers[1].respond(result);expect(await second).toBe(result);expect(workers[1].terminated).toBe(true);
});
it("leaving a workspace cancels pending analysis; errors are recoverable",async()=>{
 const workers:FakeWorker[]=[];
 const client=new RecommendationClient(()=>{const w=new FakeWorker();workers.push(w);return w;});
 const pending=client.run(request());const assertion=expect(pending).rejects.toMatchObject({name:"AbortError"});client.cancel();await assertion;
 const failed=client.run(request());const failure=expect(failed).rejects.toThrow("Retry or reload");workers[1].onerror?.({} as ErrorEvent);await failure;
 const retry=client.run(request()),result=computeRecommendations({...request(),id:0});workers[2].respond(result);expect(await retry).toBe(result);
});
