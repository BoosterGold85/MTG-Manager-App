import { it, expect, vi } from "vitest";
import { writeFileSync } from "node:fs";
it("measures fixed ranking policies without changing semantics or labels", async () => {
  const reports=[];
  for (const removed of ["none","specific","utilityCap","strategicRedundancy"]) {
    vi.resetModules();
    vi.doMock("../../src/synergy/deckSpecific",async importOriginal=>{
      const original=await importOriginal<typeof import("../../src/synergy/deckSpecific")>();
      return {...original,RANKING_POLICY:{...original.RANKING_POLICY,...(removed==="none"?{}:{[removed]:false})}};
    });
    const {runCorpus}=await import("./recall/harness");
    const report=runCorpus([]);
    expect(report.evaluated).toBe(12);
    reports.push({removed,report});
  }
  vi.doUnmock("../../src/synergy/deckSpecific");
  if(process.env.RANKING_ABLATION_OUT)writeFileSync(process.env.RANKING_ABLATION_OUT,JSON.stringify(reports,null,2));
},300000);
