import { deckOwnership,deckUsage } from "../decks/decks";
import { formatWarnings, formatOf, formatLabel } from "../decks/formats";
import {useEffect,useMemo,useRef,useState} from "react";
import type {CollectionState} from "../models/collection";
import type {Deck} from "../models/deck";
import type {DeckChange} from "../storage/deckRepository";
import {constructedCandidates,compareConstructed,isLand,key,freshLegal} from "../standard/engine";
import type {StandardCandidate} from "../standard/engine";
import {useStandardAnalysis} from "../standard/useAnalysis";
import {scryfallClient} from "../import/scryfall";
import {ownedUpgradeRows,ownedDetailCard} from "../standard/browse";
import {runLegalityCheck,savedLegalityCheckpoint} from "../import/legality";
import type {LegalityRun} from "../import/legality";
import {CardDetail} from "./CardDetail";
import {CardImage} from "./CardImage";
import {Dialog} from "./Dialog";
import {CandidateIntelligence} from "./DeckIntelligence";
type Props={state:CollectionState;deck:Deck;busy:boolean;change:(action:DeckChange,success:string)=>Promise<boolean>};
export function ConstructedUpgrades({state,deck,busy,change}:Props){
 const format=formatOf(deck)==="legacy"?"legacy":"standard",label=formatLabel(deck);
 const analysis=useStandardAnalysis<ReturnType<typeof constructedCandidates>>(state,deck);
 const [query,setQuery]=useState(""),[onlyAvailable,setOnlyAvailable]=useState(false),[sort,setSort]=useState(format==="legacy"?"brew":"fit"),[limit,setLimit]=useState(30);
 const [interestingOnly,setInterestingOnly]=useState(false),[scope,setScope]=useState("legal"),[detailId,setDetailId]=useState<string|null>(null);
 const [checkProgress,setCheckProgress]=useState(""),[saveFailed,setSaveFailed]=useState(false),[checkResult,setCheckResult]=useState<LegalityRun>();
 const run=useRef<LegalityRun|undefined>(undefined),alive=useRef(true),changeRef=useRef(change);
 useEffect(()=>{changeRef.current=change;},[change]);
 const [selected,setSelected]=useState<string|null>(null),[checking,setChecking]=useState(false),[error,setError]=useState("");
 const controller=useRef<AbortController|null>(null);useEffect(()=>{alive.current=true;return()=>{alive.current=false;controller.current?.abort();};},[]);
 const ownedRows=useMemo(()=>ownedUpgradeRows(state,deck,analysis.result),[state,deck,analysis.result]);
 const candidates=useMemo(()=>{
  const rows=ownedRows.filter(row=>(scope==="owned"||scope==="legal"&&row.legality==="legal"||scope==="compare"&&!!row.candidate)&&(!onlyAvailable||row.item.quantityUnassigned>0)&&(!interestingOnly||row.candidate?.legacyBrew?.interesting)&&row.card.name.toLowerCase().includes(query.toLowerCase()));
  rows.sort((a,b)=>Number(!!b.candidate)-Number(!!a.candidate)||(format==="legacy"||sort==="fit"?Number(b.item.quantityUnassigned>0)-Number(a.item.quantityUnassigned>0):0)||(sort==="brew"?(b.candidate?.brew || 0)-(a.candidate?.brew || 0):0)||(b.candidate?.score || 0)-(a.candidate?.score || 0)||a.card.name.localeCompare(b.card.name)||a.item.id.localeCompare(b.item.id));
  return rows;
 },[ownedRows,scope,query,onlyAvailable,sort,interestingOnly,format]);
 async function check(resume=false,unverifiedOnly=false){
  setChecking(true);setError("");setSaveFailed(false);const next=new AbortController();controller.current=next;
  const ids=[...state.items.filter(i=>i.quantityOwned>0).map(i=>i.scryfallId),...(deck.entries || []).map(e=>e.scryfallId)];
  try{
   const result=await runLegalityCheck(ids,next.signal,(batch,signal)=>scryfallClient.checkLegalityBatch(batch,signal,format),(checked,total)=>{if(alive.current)setCheckProgress(`Checked ${checked.toLocaleString()} of ${total.toLocaleString()} printings…`);},unverifiedOnly?savedLegalityCheckpoint(ids,state.metadata,format):resume?run.current:undefined);
   if(!alive.current)return;
   run.current=result;setCheckResult(result);
   let saved=true;
   if(Object.keys(result.metadata).length)saved=await changeRef.current({type:format==="legacy"?"legacy-legality":"standard-legality",deckId:deck.id,metadata:result.metadata},"Verified legality statuses saved. Ownership and assignments are unchanged.");
   if(!alive.current)return;
   if(!saved){setSaveFailed(true);setError("The lookup results are retained, but could not be saved. Load the latest collection and retry saving. Your saved data was not overwritten.");}
   else if(result.interrupted)setError(`Legality check ${result.stopped?"stopped":"paused"} after ${result.checked.toLocaleString()} of ${result.total.toLocaleString()} printings. ${Object.keys(result.metadata).length.toLocaleString()} confirmed statuses were saved. Your collection is intact. Retry remaining cards.`);
   setCheckProgress(`${Object.keys(result.metadata).length.toLocaleString()} of ${result.total.toLocaleString()} printing statuses confirmed · ${Object.keys(result.issues).length} need attention · ${result.unresolved.length.toLocaleString()} remaining`);
  }catch{if(alive.current)setError("Could not finish the legality check. Your saved collection is intact. Retry the check or browse all owned cards.");}
  finally{if(alive.current)setChecking(false);}
 }
 const missing=deckOwnership(deck,state).missing;
 const warnings=formatWarnings(state,deck);
 const chosen=analysis.result?.candidates.find(c=>c.itemId===selected);
 return <section aria-label={`${label} Upgrades`} className="deck-upgrades">
 <h2>Upgrades I Own · {label}</h2>
 {missing>0&&<p className="meta-text">{missing} decklist copies are missing/unassigned. Analysis uses the intended main deck, including missing entries.</p>}
 {warnings.length>0&&<p className="meta-text">The saved deck has {warnings.length} format warnings. Review Overview; a proposed change is not certification that the whole deck is legal.</p>}
 <p className="prose">Experimental main-deck comparisons using your owned nonland cards. Additional copies already in the deck can qualify. No cards move until you confirm a reviewed change.</p>
 <p className="meta-text">Plan Fit estimates supported relationships and role coverage. Brew Score highlights supported interactions worth exploring. Neither predicts win rate. Sideboard matchup advice, land swaps, sequencing and combo validation are outside this first release.</p>
 {format==="legacy"&&<p className="meta-text">Legacy Brew Score rewards verified reuse, supported conditions and bridges between actual main-deck partners. Interesting Brews requires local mechanical novelty; it does not claim tournament strength, rarity or a proven combo.</p>}
 <button className="management-button" disabled={busy||checking} onClick={()=>void check(!!run.current&&(!!run.current.unresolved.length||saveFailed))}>{checking?"Checking owned-card legality…":saveFailed?"Retry saving checked statuses":checkResult?.unresolved.length?"Retry remaining cards":"Check owned-card legality"}</button>
 {!checking&&ownedRows.some(r=>r.legality==="unverified")&&<button className="text-button" disabled={busy} onClick={()=>void check(false,true)}>Check unverified / stale only</button>}
 {checking&&<button className="text-button" onClick={()=>controller.current?.abort()}>Stop check</button>}
 {!checking&&checkResult?.unresolved.length ? <button className="text-button" disabled={busy} onClick={()=>void check(false)}>Restart full check</button>:null}
 {checkProgress&&<p role="status" aria-label="Legality check progress">{checkProgress}</p>}
 <p className="meta-text">The check covers all owned printings, including lands, plus this deck. Successful lookups are kept if a later batch fails. Check unverified / stale only resumes from saved statuses after a reload. Only fresh {label}-legal cards can be compared. Reading saved rules text works offline; artwork may require a connection.</p>
 {checkResult&&Object.keys(checkResult.issues).length>0&&<details><summary>Lookups needing attention ({Object.keys(checkResult.issues).length})</summary><ul>{Object.entries(checkResult.issues).map(([id,message])=><li key={id}>{state.metadata[id]?.name || id}: {message}</li>)}</ul><p>These records were retained. No card was declared illegal or removed because a lookup failed. Run a full check to retry these identifiers.</p></details>}
 {checkResult?.failure instanceof Error&&<details><summary>Last lookup error details</summary><p className="meta-text">{checkResult.failure.message}</p></details>}
 {(error||analysis.error)&&<p role="alert">{error||analysis.error} {error&&<button className="text-button" onClick={()=>{setScope("owned");setInterestingOnly(false);setQuery("");}}>Browse all owned cards</button>} {analysis.error&&<button className="text-button" onClick={analysis.retry}>Retry analysis</button>}</p>}
 <p role="status" aria-label="Upgrade catalog">{analysis.pending?`Analyzing ${label} cards…`:`${ownedRows.filter(r=>r.legality==="legal").length} legal owned printings · ${analysis.result?.candidates.length || 0} eligible owned printings for comparison · ${candidates.length} shown of ${ownedRows.length} owned printings · ${ownedRows.filter(r=>r.legality==="unverified").length} unverified/stale · ${ownedRows.filter(r=>r.legality==="not-legal").length} not legal · ${analysis.result?.riskExcluded || 0} omitted for severe downsides · ${analysis.result?.manaExcluded || 0} need mana changes`}</p>
 {analysis.result && analysis.result.mainCount<60&&<p>Add at least 60 main-deck cards before reviewing upgrades. You can browse and read your owned cards now.</p>}
 <>
 <div className="synergy-controls"><label>Search {label} upgrades<input type="search" value={query} onChange={e=>{setQuery(e.target.value);setLimit(30);}} /></label>
 <label>Show<select aria-label={`${label} browsing scope`} value={scope} onChange={e=>{setScope(e.target.value);setLimit(30);}}><option value="legal">Legal in {label}</option><option value="owned">All owned cards</option><option value="compare">Ready to compare</option></select></label>
 <label>Availability<select aria-label={`${label} availability`} value={onlyAvailable?"available":"all"} onChange={e=>setOnlyAvailable(e.target.value==="available")}><option value="all">All owned copies</option><option value="available">Available copies only</option></select></label>
 <label>Rank by<select aria-label={`${label} ranking`} value={sort} onChange={e=>setSort(e.target.value)}><option value="fit">Plan Fit</option><option value="brew">Brew Score</option></select></label>{format==="legacy"&&<button className="management-button legacy-brew-filter" aria-pressed={interestingOnly} onClick={()=>{setInterestingOnly(v=>!v);setLimit(30);}}>Interesting Brews</button>}</div>
 <ul className="synergy-candidates">{candidates.slice(0,limit).map(row=>{const {item,card,candidate:c}=row;return <li key={item.id} className="upgrade-card"><button className="synergy-art deck-art-button" aria-label={`View ${card.name} details`} onClick={()=>setDetailId(item.id)}><CardImage card={{...card,id:item.id,quantity:item.quantityOwned}} /><span className="sr-only">View {card.name} details</span></button><div><h3>{card.name}</h3>
 <p>{c?`Plan Fit ${c.score} · Brew Score ${c.brew}${c.legacyBrew?` · ${c.legacyBrew.label}`:""}`:"Browse only · not scored for comparison"}</p><p className="meta-text">{row.label} · {card.setCode.toUpperCase()} #{card.collectorNumber} · {item.finish} · {item.language}</p>
 <p>Available: {item.quantityUnassigned} · Owned: {item.quantityOwned} · In deck: {row.inDeck}</p>{deckUsage(state,item.id).length>0&&<p className="meta-text">Used in: {deckUsage(state,item.id).map(u=>`${u.deck.name} (${u.quantity})`).join(", ")}</p>}
 {row.notes.map((note,i)=><p className="meta-text" key={i}>{note}</p>)}
 {c?.legacyBrew&&<details><summary>Why this brew?</summary><ul>{c.legacyBrew.reasons.map((r,i)=><li key={i}>{r}</li>)}</ul></details>}
 {c&&<details><summary>Why it fits / tradeoffs</summary><ul>{[...c.reasons,...c.risks].map((r,i)=><li key={i}>{r}</li>)}</ul></details>}
 {c&&<CandidateIntelligence state={state} deck={deck} card={card} />}
 <button className="text-button" onClick={()=>setDetailId(item.id)}>Read {card.name}</button>
 {c&&<button className="management-button" disabled={busy||checking||(analysis.result?.mainCount || 0)<60} onClick={()=>setSelected(item.id)}>Compare {card.name}</button>}</div></li>;})}</ul>
 {candidates.length>limit&&<button className="management-button" onClick={()=>setLimit(n=>n+30)}>Show more</button>}</>
 {!analysis.pending&&!candidates.length&&!interestingOnly&&<p>No cards match this view. Choose All owned cards or clear search and availability filters to browse more.</p>}
 {format==="legacy"&&interestingOnly&&!candidates.length&&!analysis.pending&&<p>No supported novel brews were found in the verified owned cards. Turn off Interesting Brews to explore other legal candidates.</p>}
 {detailId&&(()=>{const card=ownedDetailCard(state,detailId);if(!card)return null;const index=candidates.findIndex(r=>r.item.id===detailId),row=candidates[index];return <CardDetail card={card} collection={state} onClose={()=>setDetailId(null)} navigation={index>=0?{position:index+1,total:candidates.length,onPrevious:index>0?()=>setDetailId(candidates[index-1].item.id):undefined,onNext:index<candidates.length-1?()=>setDetailId(candidates[index+1].item.id):undefined}:undefined} extra={<section aria-label="Upgrade browsing status"><h3>{row?.label || "Owned card"}</h3>{row?.notes.map((note,i)=><p key={i}>{note}</p>)}{row?.candidate&&<p>Plan Fit {row.candidate.score} · Brew Score {row.candidate.brew}. No changes are made by reading this card.</p>}</section>} />;})()}
 {chosen&&!analysis.pending&&<ConstructedComparison key={`${state.revision}:${deck.modifiedAt}:${chosen.itemId}`} state={state} deck={deck} busy={busy} change={change} candidate={chosen} onClose={()=>setSelected(null)} />}
 </section>;
}
function ConstructedComparison({state,deck,busy,change,candidate,onClose}:Props&{candidate:StandardCandidate;onClose:()=>void}){
 const format=formatOf(deck)==="legacy"?"legacy":"standard",label=formatLabel(deck);
 const cuts=(deck.entries || []).filter(e=>e.board==="main"&&!isLand(state.metadata[e.scryfallId])&&key(state.metadata[e.scryfallId])!==key(candidate.card));
 const [cutId,setCutId]=useState(""),[quantity,setQuantity]=useState(1);
 const [error,setError]=useState(""),[saving,setSaving]=useState(false);
 const controller=useRef<AbortController|null>(null);useEffect(()=>()=>controller.current?.abort(),[]);
 const comparison=useMemo(()=>({itemId:candidate.itemId,cutId,quantity}),[candidate.itemId,cutId,quantity]);
 const analysis=useStandardAnalysis<ReturnType<typeof compareConstructed>>(state,deck,comparison,!!cutId);
 const result=analysis.result;
 return <Dialog titleId="constructed-review-title" className="deck-dialog" onClose={()=>!busy&&onClose()} closeDisabled={busy}>
 <div className="dialog-heading"><h2 id="constructed-review-title">Review {label} change</h2></div><div className="deck-dialog-content">
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
 <CandidateIntelligence state={state} deck={deck} card={candidate.card} cutId={cutId} quantity={quantity} />
 {!result.canAssign&&<p>Not enough available copies for this change. Copies assigned elsewhere will not be moved.</p>}
 <p className="meta-text">{result.caution}</p></>}
 <details><summary>Read both cards</summary><h3>{candidate.card.name}</h3><p className="prose">{candidate.card.oracleText || candidate.card.cardFaces?.map(f=>f.oracleText).join("\n")}</p><h3>{state.metadata[deck.entries?.find(e=>e.id===cutId)?.scryfallId || ""]?.name}</h3><p className="prose">{state.metadata[deck.entries?.find(e=>e.id===cutId)?.scryfallId || ""]?.oracleText}</p></details>
 <button className="primary-button" disabled={busy||saving||analysis.pending||!result?.canAssign} onClick={async()=>{
  setError("");setSaving(true);const next=new AbortController();controller.current=next;
  try{
   const records=await scryfallClient.refreshLegalities([candidate.card.scryfallId],next.signal);
   if(next.signal.aborted)return;
   const verifiedCard=records[candidate.card.scryfallId];
   if(!verifiedCard || !freshLegal(verifiedCard,format)){setError(`This printing is not currently verified ${label} legal. No deck changes were saved. Check owned-card legality to update the catalog.`);return;}
   const ok=await change({type:format==="legacy"?"legacy-swap":"standard-swap",deckId:deck.id,incomingItemId:candidate.itemId,outgoingEntryId:cutId,quantity,verifiedCard},`${label} change saved atomically. Collection quantities and other decks are unchanged.`);
   if(ok)onClose();else setError("Change was not saved. Check available copies and the latest saved deck, then reopen this review.");
  }catch{if(!next.signal.aborted)setError(`Could not verify current ${label} legality. Your deck has not changed. Retry or cancel.`);}
  finally{if(!next.signal.aborted)setSaving(false);}
 }}>{saving?"Checking legality / saving…":`Confirm ${label} change`}</button>
 <button className="text-button" disabled={busy} onClick={onClose}>Cancel</button></div></Dialog>;
}
