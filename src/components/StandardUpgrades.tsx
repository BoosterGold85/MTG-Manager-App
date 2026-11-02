import { deckPlayable, deckOwnership } from "../decks/decks";
import { formatWarnings } from "../decks/formats";
import {useEffect,useMemo,useRef,useState} from "react";
import type {CollectionState} from "../models/collection";
import type {Deck} from "../models/deck";
import type {DeckChange} from "../storage/deckRepository";
import {standardCandidates,compareStandard,isLand,key,freshStandard} from "../standard/engine";
import type {StandardCandidate} from "../standard/engine";
import {useStandardAnalysis} from "../standard/useAnalysis";
import {scryfallClient} from "../import/scryfall";
import {CardImage} from "./CardImage";
import {Dialog} from "./Dialog";
type Props={state:CollectionState;deck:Deck;busy:boolean;change:(action:DeckChange,success:string)=>Promise<boolean>};
export function StandardUpgrades({state,deck,busy,change}:Props){
 const analysis=useStandardAnalysis<ReturnType<typeof standardCandidates>>(state,deck);
 const [query,setQuery]=useState(""),[onlyAvailable,setOnlyAvailable]=useState(false),[sort,setSort]=useState("fit"),[limit,setLimit]=useState(30);
 const [selected,setSelected]=useState<string|null>(null),[checking,setChecking]=useState(false),[error,setError]=useState("");
 const controller=useRef<AbortController|null>(null);useEffect(()=>()=>controller.current?.abort(),[]);
 const candidates=useMemo(()=>{
  const rows=(analysis.result?.candidates || []).filter(c=>(!onlyAvailable||c.available>0)&&c.card.name.toLowerCase().includes(query.toLowerCase()));
  if(sort==="brew")rows.sort((a,b)=>b.brew-a.brew||b.score-a.score||a.card.name.localeCompare(b.card.name));
  return rows;
 },[analysis.result,query,onlyAvailable,sort]);
 async function check(){
  setChecking(true);setError("");const next=new AbortController();controller.current=next;
  try{const ids=[...state.items.filter(i=>i.quantityOwned>0 && deckPlayable(state.metadata[i.scryfallId]) && !isLand(state.metadata[i.scryfallId])).map(i=>i.scryfallId),...(deck.entries || []).map(e=>e.scryfallId)];const metadata=await scryfallClient.refreshLegalities(ids,next.signal);if(!next.signal.aborted){const ok=await change({type:"standard-legality",deckId:deck.id,metadata},"Owned-card legality checked. No ownership or assignments changed.");if(!ok)setError("Could not save legality. Load the latest collection and retry; saved data was not overwritten.");}}
  catch{if(!next.signal.aborted)setError("Could not finish the legality check. Saved data is unchanged. Retry when connected.");}
  finally{if(!next.signal.aborted)setChecking(false);}
 }
 const missing=deckOwnership(deck,state).missing;
 const warnings=formatWarnings(state,deck);
 const chosen=analysis.result?.candidates.find(c=>c.itemId===selected);
 return <section aria-label="Standard Upgrades" className="deck-upgrades">
 <h2>Upgrades I Own · Standard</h2>
 {missing>0&&<p className="meta-text">{missing} decklist copies are missing/unassigned. Analysis uses the intended main deck, including missing entries.</p>}
 {warnings.length>0&&<p className="meta-text">The saved deck has {warnings.length} format warnings. Review Overview; a proposed change is not certification that the whole deck is legal.</p>}
 <p className="prose">Experimental main-deck comparisons using your owned nonland cards. Additional copies already in the deck can qualify. No cards move until you confirm a reviewed change.</p>
 <p className="meta-text">Plan Fit estimates supported relationships and role coverage. Brew Score highlights supported interactions worth exploring. Neither predicts win rate. Sideboard matchup advice, land swaps, sequencing and combo validation are outside this first release.</p>
 <button className="management-button" disabled={busy||checking} onClick={()=>void check()}>{checking?"Checking owned-card legality…":"Check owned-card legality"}</button>
 <p className="meta-text">Only cards marked Standard legal within the last seven days are analyzed. The check covers owned nonland candidates and this deck using Scryfall. Large collections can take a moment. Analysis uses saved card data.</p>
 {(error||analysis.error)&&<p role="alert">{error||analysis.error} {analysis.error&&<button className="text-button" onClick={analysis.retry}>Retry analysis</button>}</p>}
 <p role="status">{analysis.pending?"Analyzing Standard cards…":`${candidates.length} eligible owned printings · ${analysis.result?.unknown || 0} unverified/stale · ${analysis.result?.illegal || 0} not legal · ${analysis.result?.riskExcluded || 0} omitted for severe downsides · ${analysis.result?.manaExcluded || 0} need mana changes`}</p>
 {analysis.result && analysis.result.mainCount<60?<p>Add at least 60 main-deck cards before reviewing upgrades.</p>:<>
 <div className="synergy-controls"><label>Search Standard upgrades<input type="search" value={query} onChange={e=>{setQuery(e.target.value);setLimit(30);}} /></label>
 <label>Availability<select aria-label="Standard availability" value={onlyAvailable?"available":"all"} onChange={e=>setOnlyAvailable(e.target.value==="available")}><option value="all">All owned copies</option><option value="available">Available copies only</option></select></label>
 <label>Rank by<select aria-label="Standard ranking" value={sort} onChange={e=>setSort(e.target.value)}><option value="fit">Plan Fit</option><option value="brew">Brew Score</option></select></label></div>
 <ul className="synergy-candidates">{candidates.slice(0,limit).map(c=>{const item=state.items.find(i=>i.id===c.itemId)!;return <li key={c.itemId} className="upgrade-card"><div className="synergy-art"><CardImage card={{...c.card,id:c.itemId,quantity:c.owned}} /></div><div><h3>{c.card.name}</h3>
 <p>Plan Fit {c.score} · Brew Score {c.brew}</p><p className="meta-text">{c.card.setCode.toUpperCase()} #{c.card.collectorNumber} · {item.finish} · {item.language}</p>
 <p>Available: {c.available} · Owned: {c.owned} · In deck: {c.inDeck}</p>{c.usedIn.length>0&&<p className="meta-text">Used in: {c.usedIn.join(", ")}</p>}
 <details><summary>Why it fits / tradeoffs</summary><ul>{[...c.reasons,...c.risks].map((r,i)=><li key={i}>{r}</li>)}</ul></details>
 <button className="management-button" disabled={busy||checking} onClick={()=>setSelected(c.itemId)}>Compare {c.card.name}</button></div></li>;})}</ul>
 {candidates.length>limit&&<button className="management-button" onClick={()=>setLimit(n=>n+30)}>Show more</button>}</>}
 {chosen&&!analysis.pending&&<StandardComparison key={`${state.revision}:${deck.modifiedAt}:${chosen.itemId}`} state={state} deck={deck} busy={busy} change={change} candidate={chosen} onClose={()=>setSelected(null)} />}
 </section>;
}
function StandardComparison({state,deck,busy,change,candidate,onClose}:Props&{candidate:StandardCandidate;onClose:()=>void}){
 const cuts=(deck.entries || []).filter(e=>e.board==="main"&&!isLand(state.metadata[e.scryfallId])&&key(state.metadata[e.scryfallId])!==key(candidate.card));
 const [cutId,setCutId]=useState(""),[quantity,setQuantity]=useState(1);
 const [error,setError]=useState(""),[saving,setSaving]=useState(false);
 const controller=useRef<AbortController|null>(null);useEffect(()=>()=>controller.current?.abort(),[]);
 const comparison=useMemo(()=>({itemId:candidate.itemId,cutId,quantity}),[candidate.itemId,cutId,quantity]);
 const analysis=useStandardAnalysis<ReturnType<typeof compareStandard>>(state,deck,comparison,!!cutId);
 const result=analysis.result;
 return <Dialog titleId="standard-review-title" className="deck-dialog" onClose={()=>!busy&&onClose()} closeDisabled={busy}>
 <div className="dialog-heading"><h2 id="standard-review-title">Review Standard change</h2></div><div className="deck-dialog-content">
 <p>Add {candidate.card.name} · {candidate.card.setCode.toUpperCase()} #{candidate.card.collectorNumber} · selected owned printing only.</p>
 <label>Replace main-deck entry<select aria-label="Replace main-deck entry" disabled={busy||saving} value={cutId} onChange={e=>setCutId(e.target.value)}><option value="">Choose a card to compare</option>{cuts.map(e=><option key={e.id} value={e.id}>{e.name} ×{e.quantity} · {state.metadata[e.scryfallId].setCode.toUpperCase()} #{state.metadata[e.scryfallId].collectorNumber}</option>)}</select></label>
 <label>Copies to change<input type="number" disabled={busy||saving} min={1} max={Math.min(4,candidate.room)} value={quantity} onChange={e=>setQuantity(Number(e.target.value))} /></label>
 {!cutId&&<p>Select a main-deck entry. No cut is chosen automatically.</p>}
 {analysis.pending&&<p role="status">Comparing the full main deck…</p>}
 {(error||analysis.error)&&<p role="alert">{error||analysis.error} {analysis.error&&<button className="text-button" onClick={analysis.retry}>Retry analysis</button>}</p>}
 {result&&<><p>Available selected copies: {result.available} · Requested: {quantity}</p><p>Upgrade Value: {result.delta>0?"+":""}{result.delta} · {result.delta>0?"Positive modeled change":result.delta===0?"No modeled gain":"Negative modeled change"}</p>
 <p>Opening seven (main-deck copies {result.mainCopiesBefore} → {result.mainCopiesAfter}): chance of at least one {result.incoming}, {result.openingBefore}% → {result.openingAfter}%. Random shuffle, no mulligans; this is not a win-rate estimate.</p>
 <p>{quantity} {result.outgoing} out → {quantity} {result.incoming} in. Main-deck count stays the same. Sideboard stays unchanged.</p>
 {result.releases.length>0?<p>Copies released from this deck: {result.releases.map(r=>`${r.printing} ×${r.quantity}`).join("; ")}.</p>:<p>The removed entries have no assigned physical copies to release.</p>}
 {result.lost.length>0&&<p>Coverage lost: {result.lost.join(", ")}. Review this tradeoff.</p>}
 {!result.canAssign&&<p>Not enough available copies for this change. Copies assigned elsewhere will not be moved.</p>}
 <p className="meta-text">{result.caution}</p></>}
 <details><summary>Read both cards</summary><h3>{candidate.card.name}</h3><p className="prose">{candidate.card.oracleText || candidate.card.cardFaces?.map(f=>f.oracleText).join("\n")}</p><h3>{state.metadata[deck.entries?.find(e=>e.id===cutId)?.scryfallId || ""]?.name}</h3><p className="prose">{state.metadata[deck.entries?.find(e=>e.id===cutId)?.scryfallId || ""]?.oracleText}</p></details>
 <button className="primary-button" disabled={busy||saving||analysis.pending||!result?.canAssign} onClick={async()=>{
  setError("");setSaving(true);const next=new AbortController();controller.current=next;
  try{
   const records=await scryfallClient.refreshLegalities([candidate.card.scryfallId],next.signal);
   if(next.signal.aborted)return;
   const verifiedCard=records[candidate.card.scryfallId];
   if(!verifiedCard || !freshStandard(verifiedCard)){setError("This printing is not currently verified Standard legal. No deck changes were saved. Check owned-card legality to update the catalog.");return;}
   const ok=await change({type:"standard-swap",deckId:deck.id,incomingItemId:candidate.itemId,outgoingEntryId:cutId,quantity,verifiedCard},"Standard change saved atomically. Collection quantities and other decks are unchanged.");
   if(ok)onClose();else setError("Change was not saved. Check available copies and the latest saved deck, then reopen this review.");
  }catch{if(!next.signal.aborted)setError("Could not verify current Standard legality. Your deck has not changed. Retry or cancel.");}
  finally{if(!next.signal.aborted)setSaving(false);}
 }}>{saving?"Checking legality / saving…":"Confirm Standard change"}</button>
 <button className="text-button" disabled={busy} onClick={onClose}>Cancel</button></div></Dialog>;
}
