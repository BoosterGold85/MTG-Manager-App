import {it,expect,vi,afterEach} from "vitest";
import {handleScryfall} from "../../worker/scryfall";
import worker from "../../worker/index";
import {siteLookupFetch,LookupTransportError} from "../../src/import/transport";
import {ScryfallClient} from "../../src/import/scryfall";
import {runLegalityCheck} from "../../src/import/legality";
import {parseManaBox} from "../../src/import/csv";
import {apiCard,sol,fixtureRow,exportCsv} from "../importFixtures";
const host="https://app.example",path="/api/scryfall/cards/collection";
const req=(body:unknown={identifiers:[{id:"known"}]},extra:RequestInit={})=>new Request(host+path,{method:"POST",headers:{"Content-Type":"application/json",Origin:host,Cookie:"private-session",Authorization:"Bearer private"},body:JSON.stringify(body),...extra});
const json=(body:unknown,status=200,headers:Record<string,string>={})=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json",...headers}});
afterEach(()=>vi.unstubAllGlobals());
it("same-origin relay preserves canonical metadata and statuses without forwarding cookies/auth or caching legality",async()=>{
 const fetcher=vi.fn<typeof fetch>(async()=>json({data:[{id:"known",legalities:{legacy:"banned"}}]}));
 const response=await handleScryfall(req(),fetcher);
 expect(await response.json()).toEqual({data:[{id:"known",legalities:{legacy:"banned"}}]});expect(response.headers.get("Cache-Control")).toBe("no-store");
 const [url,init]=fetcher.mock.calls[0];expect(url).toBe("https://api.scryfall.com/cards/collection");expect(init?.body).toBe(JSON.stringify({identifiers:[{id:"known"}]}));
 const headers=new Headers(init?.headers);expect(headers.get("Cookie")).toBeNull();expect(headers.get("Authorization")).toBeNull();expect(headers.get("User-Agent")).toMatch(/^MTG-Manager\//);expect(init?.redirect).toBe("manual");
});
it("only bounded identifier batches and allowed lookup paths/methods reach Scryfall",async()=>{
 const fetcher=vi.fn<typeof fetch>(async()=>json({data:[]}));
 for(const request of [req({identifiers:[]}),req({identifiers:Array.from({length:76},()=>({id:"one"}))}),req({identifiers:[{id:"one",quantity:99}]}),req({csv:"private collection"}),req({identifiers:[{url:"https://evil.example"}]}),new Request(host+"/api/scryfall/https://evil.example"),new Request(host+path),req(undefined,{headers:{"Content-Type":"application/json",Origin:"https://evil.example"}})])expect((await handleScryfall(request,fetcher)).status).toBeGreaterThanOrEqual(400);
 expect(fetcher).not.toHaveBeenCalled();
 expect((await handleScryfall(req({identifiers:[{name:"Sol Ring"},{set:"cmm",collector_number:"410"}]}),fetcher)).status).toBe(200);
});
it("rejects oversized bodies and unknown/duplicated query options before any upstream fetch",async()=>{
 const fetcher=vi.fn<typeof fetch>(async()=>json({data:[]}));
 for(const request of [req({identifiers:[{name:"x".repeat(70000)}]}),new Request(host+"/api/scryfall/cards/search?q=ring&url=evil"),new Request(host+"/api/scryfall/cards/search?q=one&q=two"),new Request(host+"/api/scryfall/sets?q=private")])expect((await handleScryfall(request,fetcher)).status).toBe(400);
 expect(fetcher).not.toHaveBeenCalled();
});
it("search encoding and set lookups remain exact",async()=>{
 const fetcher=vi.fn<typeof fetch>(async()=>json({data:[]}));
 const query=`!"Queen's Bay Paladin" set:lci`;
 expect((await handleScryfall(new Request(host+"/api/scryfall/cards/search?unique=prints&q="+encodeURIComponent(query)),fetcher)).status).toBe(200);
 const forwarded=new URL(String(fetcher.mock.calls[0][0]));expect(forwarded.origin+forwarded.pathname).toBe("https://api.scryfall.com/cards/search");expect(forwarded.searchParams.get("q")).toBe(query);expect(forwarded.searchParams.get("unique")).toBe("prints");
 await handleScryfall(new Request(host+"/api/scryfall/sets"),fetcher);expect(fetcher.mock.calls[1][0]).toBe("https://api.scryfall.com/sets");
});
it("429, Retry-After and confirmed not-found survive the relay as readable HTTP responses",async()=>{
 const fetcher=vi.fn<typeof fetch>(async()=>json({object:"error",code:"rate_limited"},429,{"Retry-After":"3","Set-Cookie":"upstream=private"}));
 const response=await handleScryfall(req(),fetcher);expect(response.status).toBe(429);expect(response.headers.get("Retry-After")).toBe("3");expect(response.headers.get("Set-Cookie")).toBeNull();
 const found=await handleScryfall(req(),vi.fn(async()=>json({data:[],not_found:[{id:"known"}]})));expect(await found.json()).toEqual({data:[],not_found:[{id:"known"}]});
});
it("upstream network/HTML/timeout failures become JSON 502/504 instead of opaque browser errors",async()=>{
 const network=await handleScryfall(req(),vi.fn(async()=>{throw new TypeError("Load failed");}));expect(network.status).toBe(502);expect(await network.json()).toMatchObject({object:"error"});
 const html=await handleScryfall(req(),vi.fn(async()=>new Response("<html>Unavailable</html>",{status:503})));expect(html.status).toBe(502);expect(html.headers.get("Content-Type")).toContain("application/json");
 const timeout=await handleScryfall(req(),vi.fn((_input,init)=>new Promise<Response>((_resolve,reject)=>init?.signal?.addEventListener("abort",()=>reject(new DOMException("Timed out","AbortError")),{once:true}))),1);expect(timeout.status).toBe(504);
});
it("client cancellation aborts upstream work and static assets retain their own routing",async()=>{
 const controller=new AbortController();controller.abort();const fetcher=vi.fn<typeof fetch>();expect((await handleScryfall(req(undefined,{signal:controller.signal}),fetcher)).status).toBe(499);expect(fetcher).not.toHaveBeenCalled();
 const assets={fetch:vi.fn(async()=>new Response("asset"))};expect(await (await worker.fetch(new Request(host+"/collection"),{ASSETS:assets})).text()).toBe("asset");
 const health=await worker.fetch(new Request(host+"/api/scryfall/health"),{ASSETS:assets});expect(await health.json()).toMatchObject({service:"mtg-scryfall-proxy",transport:"same-origin",maxBatch:75});
 expect((await worker.fetch(new Request(host+"/api/unknown"),{ASSETS:assets})).status).toBe(404);expect(assets.fetch).toHaveBeenCalledTimes(1);
});
it("browser transport only requests the app origin, preserves abort/body, and does not fall back cross-origin",async()=>{
 const fetcher=vi.fn<typeof fetch>(async()=>json({data:[]}));vi.stubGlobal("fetch",fetcher);const controller=new AbortController(),body=JSON.stringify({identifiers:[{id:"one"}]});
 await siteLookupFetch("https://api.scryfall.com/cards/collection",{method:"POST",body,signal:controller.signal});expect(fetcher.mock.calls[0][0]).toBe("/api/scryfall/cards/collection");expect(fetcher.mock.calls[0][1]).toMatchObject({body,signal:controller.signal,credentials:"same-origin"});
 fetcher.mockRejectedValueOnce(new TypeError("Load failed"));await expect(siteLookupFetch("https://api.scryfall.com/sets")).rejects.toThrow("Load failed");expect(fetcher.mock.calls.every(([url])=>String(url).startsWith("/api/scryfall/"))).toBe(true);
});
it("an assets-only deployment gives an actionable missing-service error without repeated retries",async()=>{
 const fetcher=vi.fn<typeof fetch>(async()=>new Response("<html>app</html>",{headers:{"Content-Type":"text/html"}}));vi.stubGlobal("fetch",fetcher);
 await expect(siteLookupFetch("https://api.scryfall.com/sets")).rejects.toBeInstanceOf(LookupTransportError);
 fetcher.mockClear();const client=new ScryfallClient(undefined,0,{attempts:4,sleep:async()=>{}});
 await expect(client.refreshLegalities(["one"],new AbortController().signal)).rejects.toThrow("card lookup service is unavailable");expect(fetcher).toHaveBeenCalledTimes(1);
});
it("4,497-row import and legality checks finish over the same-site relay with a transient upstream batch",async()=>{
 const cards=Array.from({length:4497},(_,i)=>({...sol,scryfallId:`00000000-0000-4000-8000-${String(i+1).padStart(12,"0")}`,name:`Transport owned ${i}`,setCode:"tst",collectorNumber:String(i)})),byId=new Map(cards.map(c=>[c.scryfallId,c]));
 let upstreamCalls=0,failed=false;const browserCalls:string[]=[];
 const upstream:typeof fetch=vi.fn(async(_input,init)=>{
  upstreamCalls++;if(upstreamCalls===23&&!failed){failed=true;return json({object:"error",details:"Temporary outage"},503);}
  const ids=(JSON.parse(init!.body as string).identifiers as {id:string}[]).map(i=>i.id);return json({data:ids.map(id=>({...apiCard(byId.get(id)!),legalities:{legacy:"legal",standard:"not_legal"}}))});
 });
 vi.stubGlobal("fetch",vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{const path=String(input);browserCalls.push(path);if(!path.startsWith("/api/scryfall/"))throw new TypeError("Load failed");return handleScryfall(new Request(host+path,init),upstream);}));
 const client=new ScryfallClient(undefined,0,{attempts:2,backoffMs:0,sleep:async()=>{}}),signal=new AbortController().signal,parsed=parseManaBox(exportCsv(cards.map(c=>fixtureRow(c))));
 const resolved=await client.resolve(parsed.rows,{}, {},signal,()=>{});expect(resolved.results.size).toBe(4497);expect([...resolved.results.values()].every(r=>!!r.card)).toBe(true);
 const checked=await runLegalityCheck(cards.map(c=>c.scryfallId),signal,(b,s)=>client.checkLegalityBatch(b,s,"legacy"),()=>{});expect(checked.checked).toBe(4497);expect(checked.issues).toEqual({});expect(checked.unresolved).toEqual([]);
 expect(browserCalls).toHaveLength(121);expect(browserCalls.every(p=>p.startsWith("/api/scryfall/"))).toBe(true);expect(upstreamCalls).toBe(121);
});
it("preserves upstream failure details through the browser client instead of hiding every cause as 502",async()=>{
 const fetcher=vi.fn<typeof fetch>(async()=>handleScryfall(req(),async()=>new Response('<html>Unavailable</html>',{status:503,headers:{'Content-Type':'text/html'}})));
 const client=new ScryfallClient(fetcher,0,{attempts:1,sleep:async()=>{}});
 await expect(client.refreshLegalities(['known'],new AbortController().signal)).rejects.toThrow('upstream HTTP 503, content type text/html');
});

it("rejects upstream redirects without following arbitrary destinations",async()=>{
 const fetcher=vi.fn<typeof fetch>(async()=>new Response(null,{status:302,headers:{Location:'https://untrusted.example/'}}));const response=await handleScryfall(req(),fetcher);expect(response.status).toBe(502);expect((await response.json()).details).toContain('was not followed');expect(fetcher).toHaveBeenCalledTimes(1);expect(fetcher.mock.calls[0][1]?.redirect).toBe('manual');
});
