import {useStandardAnalysis} from '../standard/useAnalysis';
import type {constructedCandidates} from '../standard/engine';
import {useMemo,useState} from 'react';
import type {CollectionState} from '../models/collection';
import type {Deck} from '../models/deck';
import type {StandardCandidate} from '../standard/engine';
import {formatOf} from '../decks/formats';
import {canonicalInput} from '../upgrades/inputs';
import {brewFor,synergyFor} from '../upgrades';
import {discoveryInput} from '../experimental/universal/discoveryInput';
import {withoutCard} from '../experimental/universal/deckPreview';
import {AnalyzerSession} from './ExperimentalSynergyAnalyzer';
import {analyzerAvailable} from '../experimental/universal/activation';
import {BrewLabDiscovery,RemovalPreview} from './BrewLabDiscovery';

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
 // Same eligibility as discovery: one printing per Oracle card, owned nonland candidates inside the commander's identity.
 const eligible=useMemo(()=>discoveryInput(state,deck),[state,deck]);
 const deckIds=useMemo(()=>new Set(eligible.deckCards.map(c=>c.scryfallId)),[eligible]);
 const cards=useMemo(()=>[...eligible.deckCards,...eligible.candidates].sort((a,b)=>a.name.localeCompare(b.name)),[eligible]);
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
 <BrewLabDiscovery state={state} deck={deck} onInspect={next=>{setId(next);setCut('');}}/>
 <label>Card or upgrade candidate<select aria-label="Brew Lab card" value={id} onChange={e=>{setId(e.target.value);setCut('');}}><option value="">Choose a saved deck card or owned candidate</option>{cards.map(c=><option key={c.scryfallId} value={c.scryfallId}>{c.name}{deckIds.has(c.scryfallId)?' · in deck':' · owned candidate'}</option>)}</select></label>
 {eligible.outsideIdentity>0&&<p className="meta-text">{eligible.outsideIdentity} owned {eligible.outsideIdentity===1?'card is':'cards are'} hidden for being outside your commander's color identity. Lands and duplicate printings are not listed.</p>}
 {card&&<><h3>{card.name} · same-card comparison</h3><h4>Original Brew Engine · authoritative baseline</h4>
 {baseline?<><p>Original Plan Fit {baseline.fit} · Original Brew Score {baseline.brew}</p><ul>{baseline.reasons.map((r,i)=><li key={i}>{r}</li>)}</ul></>:<p>The original engine has no eligible scored comparison for this printing in this view. No score is invented. You can still inspect its rules below.</p>}
 <p>These are the original engine's existing fit and Brew values; they are not new mechanical-verification claims. Scores remain the original saved-deck baseline during removal previews.</p>
 <label>Hypothetical replacement / removal<select aria-label="Brew Lab remove card" value={cut} onChange={e=>setCut(e.target.value)}><option value="">Original deck context</option>{eligible.deckCards.filter(c=>c.scryfallId!==id&&(!card?.oracleId||c.oracleId!==card.oracleId)).map(c=><option key={c.scryfallId} value={c.scryfallId}>Without {c.name} (all copies)</option>)}</select></label>
 <p>{cut?'Preview excludes all copies of the named card; the selected candidate is available for testing in its place. Reset to Original deck context to compare.':'Select partners and starting resources below, then run the same-card scenario or candidate search.'} No deck edits or legality certification occur.</p>
 {cut&&<RemovalPreview key={`cut:${id}:${cut}`} state={state} deck={deck} projected={projected} focus={card} cut={eligible.deckCards.find(c=>c.scryfallId===cut)!}/>}
 <BrewLabDiscovery key={`discover:${id}:${cut}`} state={state} deck={projected} focus={card}/>
 <h4>Universal Synergy Engine · provisional mechanical evidence</h4>
 <AnalyzerSession key={`${id}:${cut}`} state={state} deck={projected} focusCard={card}/></>}
 </div>;
}
