import {useStandardAnalysis} from '../standard/useAnalysis';
import type {constructedCandidates} from '../standard/engine';
import {useMemo,useState} from 'react';
import type {CardMetadata,CollectionState} from '../models/collection';
import type {Deck} from '../models/deck';
import type {StandardCandidate} from '../standard/engine';
import {formatOf} from '../decks/formats';
import {deckDnaInput} from '../dna/engine';
import {canonicalInput} from '../upgrades/inputs';
import {brewFor,synergyFor} from '../upgrades';
import {withoutCard} from '../experimental/universal/deckPreview';
import {AnalyzerSession} from './ExperimentalSynergyAnalyzer';
import {analyzerAvailable} from '../experimental/universal/activation';

export function BrewLab({state,deck,legacyCandidates}:{state:CollectionState;deck:Deck;legacyCandidates?:StandardCandidate[]}){
 const [open,setOpen]=useState(false);
 return <section aria-label="Experimental Brew Lab" className="overview-block"><h2>Brew Lab · Experimental</h2>
 <p>Compare the authoritative production Brew Engine with provisional mechanical evidence. No second numerical score, ranking changes, or saved changes.</p>
 {!analyzerAvailable()?<p>Developer release is not enabled in this build.</p>:<><button className="management-button" onClick={()=>setOpen(v=>!v)}>{open?'Close Brew Lab':'Open Brew Lab'}</button>{open&&<OpenLab key={`${deck.id}:${state.revision}`} state={state} deck={deck} legacyCandidates={legacyCandidates}/>}</>}
 </section>;
}
function OpenLab(props:{state:CollectionState;deck:Deck;legacyCandidates?:StandardCandidate[]}){return formatOf(props.deck)==='commander'?<LabSession {...props}/>:<LegacyLab {...props}/>;}
function LegacyLab({state,deck}:{state:CollectionState;deck:Deck}){const analysis=useStandardAnalysis<ReturnType<typeof constructedCandidates>>(state,deck);return <><p>{analysis.pending?'Loading original engine comparisons…':analysis.error||''}</p><LabSession state={state} deck={deck} legacyCandidates={analysis.result?.candidates}/></>;}
function LabSession({state,deck,legacyCandidates}:{state:CollectionState;deck:Deck;legacyCandidates?:StandardCandidate[]}){
 const input=useMemo(()=>deckDnaInput(state,deck),[state,deck]);
 const cards=useMemo(()=>{
  const all=new Map<string,CardMetadata>();
  for(const c of input.cards)all.set(c.card.scryfallId,c.card);
  for(const item of state.items)if(item.quantityOwned>0&&state.metadata[item.scryfallId])all.set(item.scryfallId,state.metadata[item.scryfallId]);
  return [...all.values()].sort((a,b)=>a.name.localeCompare(b.name));
 },[input,state]);
 const [id,setId]=useState(''),[cut,setCut]=useState('');
 const card=cards.find(c=>c.scryfallId===id);
 const baseline=useMemo(()=>{
  if(!card)return null;
  if(formatOf(deck)!=='commander'){
   const c=legacyCandidates?.find(c=>c.card.scryfallId===card.scryfallId);
   return c?{fit:c.score,brew:c.brew,reasons:[...c.reasons,...(c.legacyBrew?.reasons||[]),...c.risks]}:null;
  }
  const canonical=canonicalInput(state,card),synergy=synergyFor(state,deck,{...card,id:card.scryfallId,quantity:1}),brew=brewFor(state,deck,{...card,id:card.scryfallId,quantity:1},canonical.identity);
  return {fit:synergy.score,brew:brew.score,reasons:[...synergy.reasons,...brew.why.map(w=>`${w.title}: ${w.text}`)]};
 },[state,deck,card,legacyCandidates]);
 // Only ephemeral analysis input changes. No repository or collection-write API.
 const projected=useMemo(()=>cut?withoutCard(state,deck,cut):deck,[state,deck,cut]);
 return <div><p>Your saved deck is the baseline. Unknown means unresolved, never negative card value. Findings have not been independently reviewed and are not proven game or win-rate claims.</p>
 <label>Card or upgrade candidate<select aria-label="Brew Lab card" value={id} onChange={e=>{setId(e.target.value);setCut('');}}><option value="">Choose a saved deck card or owned candidate</option>{cards.map(c=><option key={c.scryfallId} value={c.scryfallId}>{c.name}{input.cards.some(x=>x.card.scryfallId===c.scryfallId)?' · in deck':' · owned candidate'}</option>)}</select></label>
 {card&&<><h3>{card.name} · same-card comparison</h3><h4>Original Brew Engine · authoritative baseline</h4>
 {baseline?<><p>Original Plan Fit {baseline.fit} · Original Brew Score {baseline.brew}</p><ul>{baseline.reasons.map((r,i)=><li key={i}>{r}</li>)}</ul></>:<p>The original engine has no eligible scored comparison for this printing in this view. No score is invented. You can still inspect its rules below.</p>}
 <p>These are the original engine's existing fit and Brew values; they are not new mechanical-verification claims. Scores remain the original saved-deck baseline during removal previews.</p>
 <label>Hypothetical replacement / removal<select aria-label="Brew Lab remove card" value={cut} onChange={e=>setCut(e.target.value)}><option value="">Original deck context</option>{input.cards.filter(c=>c.card.scryfallId!==id).map(c=><option key={c.card.scryfallId} value={c.card.scryfallId}>Without {c.card.name} (all copies)</option>)}</select></label>
 <p>{cut?'Preview excludes all copies of the named card; the selected candidate is available for testing in its place. Reset to Original deck context to compare.':'Select partners and starting resources below, then run the same-card scenario or candidate search.'} No deck edits or legality certification occur.</p>
 <h4>Universal Synergy Engine · provisional mechanical evidence</h4>
 <AnalyzerSession key={`${id}:${cut}`} state={state} deck={projected} focusCard={card}/></>}
 </div>;
}
