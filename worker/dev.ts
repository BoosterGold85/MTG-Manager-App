import type {Plugin,Connect} from "vite";
import {handleScryfall,LOOKUP_PREFIX} from "./scryfall";
// Vite dev/preview implements the same route, rather than a different browser transport.
export function lookupService():Plugin{
 const install=(middlewares:Connect.Server)=>middlewares.use(async(req,res,next)=>{
  if(!req.url?.startsWith(`${LOOKUP_PREFIX}/`))return next();
  const controller=new AbortController(),abort=()=>controller.abort();
  req.on("aborted",abort);res.on("close",()=>{if(!res.writableEnded)abort();});
  try{
   const chunks:Buffer[]=[];let length=0;
   for await(const chunk of req){const buffer=Buffer.from(chunk);length+=buffer.length;if(length>64*1024){res.writeHead(413,{"Content-Type":"application/json"});res.end(JSON.stringify({object:"error",details:"Lookup request too large."}));return;}chunks.push(buffer);}
   const headers=new Headers();for(const [key,value]of Object.entries(req.headers))if(value)headers.set(key,Array.isArray(value)?value.join(","):value);
   const request=new Request(`http://${req.headers.host}${req.url}`,{method:req.method,headers,signal:controller.signal,...(req.method!=="GET"&&req.method!=="HEAD"?{body:Buffer.concat(chunks)}:{})});
   const response=await handleScryfall(request);
   res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch{if(!res.writableEnded){res.writeHead(502,{"Content-Type":"application/json","Cache-Control":"no-store"});res.end(JSON.stringify({object:"error",details:"The local lookup service could not finish."}));}}
  finally{req.off("aborted",abort);}
 });
 return {name:"mtg-same-origin-lookups",configureServer(server){install(server.middlewares);},configurePreviewServer(server){install(server.middlewares);}};
}
