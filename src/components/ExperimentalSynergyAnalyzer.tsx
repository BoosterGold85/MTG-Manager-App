import {useEffect,useMemo,useRef,useState} from 'react';
import type {CollectionState} from '../models/collection';
import type {Deck} from '../models/deck';
import {deckDnaInput} from '../dna/engine';
import {formatOf} from '../decks/formats';
import type {AnalyzerRequest,AnalyzerResult} from '../experimental/universal/analyze';
import {ANALYZER_VERSION} from '../experimental/universal/analyze';
import {emptyMana} from '../experimental/universal/model';
import type {Mana,Zone} from '../experimental/universal/model';
import {fingerprint} from '../experimental/universal/compiler';
export function ExperimentalSynergyAnalyzer({state,deck}:{state:CollectionState;deck:Deck}){
 const [open,setOpen]=useState(false);
 return <section className="overview-block" aria-label="Experimental Synergy Analyzer"><h2>Experimental Synergy Analyzer</h2><p className="meta-text">Opt-in, read-only mechanical research. Incomplete coverage; this does not change Plan Fit, Brew Score, upgrades, or saved cards.</p><button className="management-button" onClick={()=>setOpen(!open)}>{open?'Close experimental analyzer':'Open experimental analyzer'}</button>{open&&<AnalyzerSession key={`${deck.id}:${state.revision}`} state={state} deck={deck}/>}</section>;
}
function AnalyzerSession({state,deck}:{state:CollectionState;deck:Deck}){
 const input=useMemo(()=>deckDnaInput(state,deck),[state,deck]);
 const cards=useMemo(()=>input.cards.map(c=>c.card),[input]);
 const [selected,setSelected]=useState<Record<string,Zone>>({}),[mana,setMana]=useState<Mana>(emptyMana),[library,setLibrary]=useState(40);
 const [result,setResult]=useState<AnalyzerResult|null>(null),[error,setError]=useState(''),[running,setRunning]=useState(false);
 const active=useRef<{worker:Worker;timer:ReturnType<typeof setTimeout>;id:string}|null>(null);
 const stop=()=>{if(active.current){clearTimeout(active.current.timer);active.current.worker.terminate();active.current=null;}};
 useEffect(()=>()=>{if(active.current){clearTimeout(active.current.timer);active.current.worker.terminate();active.current=null;}},[]);
 const revision=useMemo(()=>fingerprint([ANALYZER_VERSION,deck.id,formatOf(deck),input.revision,cards]),[deck,input,cards]);
 const run=()=>{
  stop();setResult(null);setError('');setRunning(true);
  const id=crypto.randomUUID();
  try{
   const worker=new Worker(new URL('../experimental/universal/analyzer.worker.ts',import.meta.url),{type:'module'});
   const fail=(message:string)=>{if(active.current?.id!==id)return;stop();setRunning(false);setError(message);};
   const timer=setTimeout(()=>fail('Analysis timed out. Search is incomplete; saved data is unchanged.'),8000);
   active.current={worker,timer,id};
   worker.onerror=()=>fail('The experimental worker could not finish. Saved data is unchanged.');
   worker.onmessage=(e:MessageEvent<{id:string;revision:string;result?:AnalyzerResult;error?:string}>)=>{
    if(!e.data||active.current?.id!==id||e.data.id!==id||e.data.revision!==revision)return;
    if(e.data.error)return fail(e.data.error);
    if(!e.data.result||e.data.result.version!==ANALYZER_VERSION||JSON.stringify(e.data.result).length>1024*1024)return fail('Result exceeded the display limit. Analysis is incomplete.');
    stop();setRunning(false);setResult(e.data.result);
   };
   const request:AnalyzerRequest={id,revision,version:ANALYZER_VERSION,cards,selected:Object.entries(selected).map(([id,zone])=>({id,zone})),mana,library};
   worker.postMessage(request);
  }catch{stop();setRunning(false);setError('The experimental worker is unavailable. Saved data is unchanged.');}
 };
 const invalidate=()=>{stop();setRunning(false);setResult(null);setError('');};
 const missing=deck.entries?.filter(e=>e.board!=='sideboard'&&!state.metadata[e.scryfallId]).length||0;
 return <div><p><strong>This is not a complete deck analysis.</strong> Scan saved cards for supported clauses, or select up to three cards to search a hypothetical interaction. No chains is a valid result; unsupported text is not proof of no synergy.</p>
 <p className="meta-text">{input.cards.reduce((n,c)=>n+c.quantity,0)} decklist copies · {cards.length} distinct canonical cards available · {missing} entries missing metadata. Main deck and Commander only; sideboard excluded. No lookup or reimport is required.</p>
 <details><summary>Choose a targeted hypothetical scenario</summary><p>All selected objects are controlled and owned by you. Battlefield selections are assumed untapped and ready to use. Unselected deck cards are excluded from this scenario, not assumed irrelevant in a real game. These assumptions are not your current board state.</p>
 <fieldset disabled={running}><legend>Select up to three existing deck cards</legend>{cards.map(c=><div key={c.scryfallId}><label><input type="checkbox" style={{width:22,height:22,display:"inline-block",marginRight:"var(--space-8)",accentColor:"var(--accent)"}} checked={!!selected[c.scryfallId]} disabled={!selected[c.scryfallId]&&Object.keys(selected).length>=3} onChange={e=>{invalidate();setSelected(old=>{const next={...old};if(e.target.checked)next[c.scryfallId]='hand';else delete next[c.scryfallId];return next;});}}/>{c.name}</label>{selected[c.scryfallId]&&<label>Starting zone for {c.name}<select value={selected[c.scryfallId]} onChange={e=>{invalidate();setSelected({...selected,[c.scryfallId]:e.target.value as Zone});}}><option value="hand">Hand</option><option value="battlefield">Battlefield (ready)</option><option value="graveyard">Graveyard</option></select></label>}</div>)}</fieldset>
 <fieldset disabled={running}><legend>Hypothetical starting mana (not generated by the deck)</legend>{Object.keys(mana).map(color=><label key={color}>{color} mana<input type="number" min="0" max="20" value={mana[color as keyof Mana]} onChange={e=>{invalidate();setMana({...mana,[color]:Number(e.target.value)});}}/></label>)}<label>Hypothetical library cards<input type="number" min="0" max="500" value={library} onChange={e=>{invalidate();setLibrary(Number(e.target.value));}}/></label><p>Starting life: 40 each; main phase, priority, empty stack; one modeled opponent and no intervening responses.</p></fieldset></details>
 <button className="management-button" disabled={running||cards.length>500} onClick={run}>{Object.keys(selected).length?'Analyze selected scenario':'Scan supported mechanics'}</button>{running&&<button className="management-button" onClick={()=>{stop();setRunning(false);setError('Analysis cancelled. Saved data is unchanged.');}}>Cancel analysis</button>}
 {running&&<p role="status">Analyzing in an isolated worker…</p>}{error&&<p role="alert">{error}</p>}
 {result&&<div aria-label="Experimental analysis results"><h3>Actual analysis coverage</h3><p>{result.cards.filter(c=>c.abilities.length).length} of {result.cards.length} cards have modeled abilities. {result.cards.filter(c=>c.unsupported.length||c.deferred.length).length} have unsupported clauses, contexts, or deferred mechanics. Parsed clauses do not mean complete card understanding.</p><p>{result.proofs.length} discovered interaction paths · {result.explored} states explored · {result.truncated?'Search truncated — incomplete':'Bounded search finished; not exhaustive rules coverage'}.</p>
 {!result.selected.length&&<p>No game-state search was attempted. Select participants and starting resources to test a scenario.</p>}
 {result.selected.length>0&&<p>Scenario objects: {result.selected.map(c=>`${c.name} (${c.zone})`).join(' · ')}. Library: {library}; starting mana: {Object.entries(mana).map(([c,n])=>`${c} ${n}`).join(', ')}.</p>}
 {result.proofs.length===0&&<p>No supported interaction chain was discovered in this bounded run. This does not establish that the cards lack synergy.</p>}
 {result.proofs.map((p,i)=><details key={i}><summary>{p.status==='Verified'?'Verified within this hypothetical supported subset':p.status} — path {i+1}{p.searchTruncated?' (alternatives truncated)':''}</summary><p>Not a certified real-game or whole-deck claim. Independent mechanical correctness validation remains incomplete.</p><p>Required participants: {p.participants.map(id=>result.selected.find(s=>s.id===id)?.name || `Generated object ${id}`).join(" · ")}</p><h4>Prerequisites and checks</h4><ul>{p.assumptions.map(a=><li key={a}>{a}</li>)}{p.checks.map((c,j)=><li key={j}>{c.role==='branch'?'Branch outcome':'Required check'} — {c.requirement}: {String(c.result)}</li>)}</ul><h4>Mechanical proof and source evidence</h4><ol>{p.events.map(e=><li key={e.id}>{e.note}<ul>{e.evidence.map(v=><li key={v.id}>{result.cards.find(card=>card.oracleId===v.oracleId)?.name || v.oracleId}: {v.text} — {v.rule}, {v.line>=0?`Oracle line ${v.line+1}`:'rules reference'}</li>)}</ul></li>)}</ol><h4>Gross payoff (events) and terminal holdings</h4><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify({payoff:p.payoff,holdings:p.holdings},null,2)}</pre></details>)}
 {result.rejections.length>0&&<details><summary>Unresolved or rejected actions ({result.rejections.length})</summary>{result.rejections.map((r,i)=><p key={i}>{r.status}: {r.prerequisites.join('; ')}</p>)}</details>}
 <details><summary>Card interpretation and unsupported mechanics ({result.cards.length})</summary>{result.cards.map(c=><div key={c.id}><h4>{c.name}</h4><p>{c.abilities.length} modeled abilities; {c.unsupported.length} unsupported items; {c.deferred.length} deferred mechanics.</p>{c.abilities.map(a=><p key={a.id}>{a.evidence.text} — {a.kind}</p>)}{c.unsupported.map((s,i)=><p key={`u${i}`}>Unsupported: {s}</p>)}{c.deferred.map((s,i)=><p key={`d${i}`}>Deferred: {s}</p>)}</div>)}</details></div>}
 </div>;
}
