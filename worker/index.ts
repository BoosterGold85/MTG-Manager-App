import {handleScryfall,LOOKUP_PREFIX} from "./scryfall";
interface Env {ASSETS:{fetch(request:Request):Promise<Response>};}
export default {
 async fetch(request:Request,env:Env):Promise<Response>{
  const path=new URL(request.url).pathname;
  if(path===LOOKUP_PREFIX||path.startsWith(`${LOOKUP_PREFIX}/`))return handleScryfall(request);
  if(path.startsWith("/api/"))return new Response(JSON.stringify({object:"error",details:"Unknown API endpoint."}),{status:404,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
  return env.ASSETS.fetch(request);
 }
};
