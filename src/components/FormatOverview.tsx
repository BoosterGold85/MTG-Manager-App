import { useEffect, useRef, useState } from "react";
import type { CollectionState } from "../models/collection";
import type { Deck } from "../models/deck";
import type { DeckChange } from "../storage/deckRepository";
import { formatLabel, formatWarnings } from "../decks/formats";
import { scryfallClient } from "../import/scryfall";
export function FormatOverview({state,deck,busy,change}:{state:CollectionState;deck:Deck;busy:boolean;change:(action:DeckChange,success:string)=>Promise<boolean>}){
 const [checking,setChecking]=useState(false),[error,setError]=useState("");
 const controller=useRef<AbortController|null>(null);
 useEffect(()=>()=>controller.current?.abort(),[]);
 const warnings=formatWarnings(state,deck);
 const timestamps=(deck.entries || []).map(e=>state.metadata[e.scryfallId]?.legalityCheckedAt).filter((v):v is string=>!!v).sort();
 async function check(){
  setChecking(true);setError("");const next=new AbortController();controller.current=next;
  try{const metadata=await scryfallClient.refreshLegalities((deck.entries || []).map(e=>e.scryfallId),next.signal);if(!next.signal.aborted)await change({type:"check-legality",deckId:deck.id,metadata},"Format legality checked against Scryfall. Ownership is unchanged.");}
  catch(e){if(!next.signal.aborted)setError(e instanceof Error?e.message:"Could not check legality. Retry.");}
  finally{if(!next.signal.aborted)setChecking(false);}
 }
 return <section className="overview-block" aria-label="Format legality"><h2>{formatLabel(deck)} deck</h2>
 <p>At least 60 main-deck cards · up to 15 sideboard cards · generally four copies per card across both boards.</p>
 <p className="meta-text">{deck.format==="legacy"?"Legacy does not rotate; bans and card eligibility can change.":"Standard rotation and bans can change."} Saved metadata is a snapshot, not a live legality guarantee. The check covers card legality and deck counts, not tournament registration, competitive readiness or Companion conditions.</p>
 {timestamps.length>0 && <p className="meta-text">Oldest saved legality check: {new Date(timestamps[0]).toLocaleDateString()}</p>}
 <button className="management-button" disabled={busy || checking || !deck.entries?.length} onClick={()=>void check()}>{checking?"Checking legality…":"Check format legality"}</button>
 {error && <p role="alert">{error}</p>}
 <ul>{warnings.map(w=><li key={w}>{w}</li>)}</ul>
 {!warnings.length && <p>No issues found in saved format data.</p>}
 </section>;
}
