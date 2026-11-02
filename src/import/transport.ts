export class LookupTransportError extends Error {}
// The production browser only contacts its own site. Scryfall remains the upstream
// canonical source, but CORS/preflight/third-party browser failures are removed.
export const siteLookupFetch:typeof fetch=async(input,init)=>{
 const source=new URL(String(input));
 if(source.origin!=="https://api.scryfall.com")throw new LookupTransportError("Unsupported lookup source.");
 const response=await fetch(`/api/scryfall${source.pathname}${source.search}`,{...init,credentials:"same-origin"});
 const type=response.headers.get("Content-Type") || "";
 if(!type.toLowerCase().includes("application/json"))throw new LookupTransportError("MTG Manager’s card lookup service is unavailable. Reload after the site updates, then retry remaining cards. Your collection is intact.");
 return response;
};
