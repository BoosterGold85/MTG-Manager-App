import {version} from "../package.json";
export const LOOKUP_PREFIX="/api/scryfall";
const MAX_BODY=64*1024;
const MAX_RESPONSE=8*1024*1024;
const headers={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-MTG-Lookup-Transport":"same-origin"};
const error=(status:number,details:string)=>new Response(JSON.stringify({object:"error",code:"lookup_service_error",details}),{status,headers});
async function boundedText(request:Request){
 const reader=request.body?.getReader();if(!reader)return "";
 const decoder=new TextDecoder();let size=0,text="";
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BODY){await reader.cancel();throw new Error("Request too large");}text+=decoder.decode(value,{stream:true});}return text+decoder.decode();}finally{reader.releaseLock();}
}
function validIdentifier(value:unknown){
 if(!value||typeof value!=="object"||Array.isArray(value))return false;
 const id=value as Record<string,unknown>,keys=Object.keys(id);
 if(!keys.length||keys.some(k=>!["id","set","collector_number","name"].includes(k)||typeof id[k]!=="string"||!(id[k] as string).trim()||(id[k] as string).length>512))return false;
 if(id.id)return keys.length===1;
 return !!(id.set&&id.collector_number&&!id.name)||!!(id.name&&!id.collector_number);
}
// Public canonical metadata only. No arbitrary URLs, credentials, CSVs, inventory or storage.
export async function handleScryfall(request:Request,fetcher:typeof fetch=fetch,timeoutMs=15000):Promise<Response>{
 const url=new URL(request.url),path=url.pathname.slice(LOOKUP_PREFIX.length);
 const origin=request.headers.get("Origin");
 if(origin&&origin!==url.origin)return error(403,"Cross-site lookup requests are not allowed.");
 if(path==="/health"&&request.method==="GET")return new Response(JSON.stringify({service:"mtg-scryfall-proxy",version,transport:"same-origin",maxBatch:75}),{headers});
 const collection=path==="/cards/collection",search=path==="/cards/search",sets=path==="/sets";
 if(!collection&&!search&&!sets)return error(404,"Unknown lookup endpoint.");
 if(request.method!==(collection?"POST":"GET"))return error(405,"This lookup method is not supported.");
 const keys=[...url.searchParams.keys()];
 if(new Set(keys).size!==keys.length||keys.some(k=>!search||!["q","unique"].includes(k)))return error(400,"Unsupported lookup parameters.");
 if(search&&(!url.searchParams.get("q")?.trim()||url.searchParams.get("q")!.length>1024||url.searchParams.has("unique")&&!["prints","cards","art"].includes(url.searchParams.get("unique")!)))return error(400,"Invalid card search.");
 let body:string|undefined;
 if(collection){
  if(!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json"))return error(415,"Card lookups require JSON identifiers.");
  try{const payload=JSON.parse(await boundedText(request));if(!payload||Object.keys(payload).length!==1||!Array.isArray(payload.identifiers)||payload.identifiers.length<1||payload.identifiers.length>75||!payload.identifiers.every(validIdentifier))return error(400,"Provide one to 75 card identifiers.");body=JSON.stringify({identifiers:payload.identifiers});}catch{return error(400,"The card lookup request is invalid or too large.");}
 }
 const controller=new AbortController(),abort=()=>controller.abort();
 if(request.signal.aborted)return error(499,"The lookup was canceled.");
 request.signal.addEventListener("abort",abort,{once:true});const timer=setTimeout(abort,timeoutMs);
 try{
  const response=await fetcher(`https://api.scryfall.com${path}${url.search}`,{method:request.method,body,signal:controller.signal,redirect:"error",headers:{Accept:"application/json","User-Agent":`MTG-Manager/${version} (https://github.com/BoosterGold85/MTG-Manager-App)`,...(collection?{"Content-Type":"application/json"}:{}),"Cache-Control":"no-store"}});
  const text=await response.text();
  if(text.length>MAX_RESPONSE)return error(502,"Scryfall returned an unexpectedly large response. Retry remaining cards.");
  try{JSON.parse(text);}catch{return error(502,`Scryfall returned an unreadable response (upstream HTTP ${response.status}, content type ${response.headers.get("Content-Type")?.split(";")[0] || "unknown"}). Retry remaining cards.`);}
  const forwarded=new Headers(headers),retryAfter=response.headers.get("Retry-After");if(retryAfter)forwarded.set("Retry-After",retryAfter);
  return new Response(text,{status:response.status,headers:forwarded});
 }catch{
  if(request.signal.aborted)return error(499,"The lookup was canceled.");
  return error(controller.signal.aborted?504:502,controller.signal.aborted?"The lookup service timed out contacting Scryfall. Retry remaining cards.":"The lookup service could not reach Scryfall. Retry remaining cards.");
 }finally{clearTimeout(timer);request.signal.removeEventListener("abort",abort);}
}
