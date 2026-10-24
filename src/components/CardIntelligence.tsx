import { useState } from 'react';
import type { SampleCollectionCard } from '../models/card';
import type { Override } from '../intelligence/types';
import { taxonomy, tagDefinition } from '../intelligence/taxonomy';
import { effectiveAssignments } from '../intelligence/tagger';
export function CardIntelligence({card,onSave}:{card:SampleCollectionCard;onSave?:(override:Override)=>Promise<void>}) {
 const [editing,setEditing]=useState(false),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const auto=card.analysis, override=card.tagOverrides || {added:[],suppressed:[]};
 const active=effectiveAssignments(auto,override).filter(a=>tagDefinition(a.tagId));
 const groups=[...new Set(active.map(a=>tagDefinition(a.tagId)!.category))];
 async function save(next:Override) {
  if(!onSave || busy) return; setBusy(true);setError('');
  try {await onSave(next);} catch(reason) {setError(reason instanceof Error?reason.message:'Could not save tags. Please retry.');}
  finally {setBusy(false);}
 }
 const options=[...taxonomy,...(auto?.assignments||[]).map(a=>tagDefinition(a.tagId)!).filter(t=>t.id.startsWith('typal:'))];
 return <section className="intelligence" aria-label="Card Intelligence">
  <div className="section-label"><h3>Card Intelligence</h3>{onSave && <button className="text-button" onClick={()=>setEditing(!editing)}>{editing?'Done editing':'Edit Tags'}</button>}</div>
  <p className="intelligence-note">Local rules · {auto?.rulesetVersion || 'Awaiting analysis'} · confidence is a heuristic, not a probability. Open a tag for its evidence.</p>
  {!active.length && <p>No confident automatic tags yet. You can add a tag manually.</p>}
  {groups.map(category=><div className="tag-category" key={category}><h4>{category}</h4><div className="intelligent-tags">{active.filter(a=>tagDefinition(a.tagId)?.category===category).map(a=><details className="tag-evidence" key={a.tagId}>
    <summary><span>{tagDefinition(a.tagId)?.label}</span><small>{a.source==='manual-add'?'Added by you':'Auto'}</small><span className="sr-only"> · Why this tag?</span></summary>
    <div><p>{tagDefinition(a.tagId)?.description}</p><p>{a.source==='manual-add'?'Added by you':`${a.source === 'derived'?'Derived rule':'Rule'} · heuristic ${a.confidence.toFixed(2)}`} · ruleset {a.rulesetVersion}</p>
     {a.evidence.map((e,i)=><blockquote key={i}><strong>{e.face ? `${e.face} · `:''}{e.field}</strong><p>“{e.snippet}”</p><p>{e.reason}</p></blockquote>)}
    </div></details>)}</div></div>)}
  {auto && (auto.creatureTypes.own.length>0 || auto.creatureTypes.referenced.length>0) && <details className="type-signals"><summary>Creature-type signals</summary><p>Own types: {auto.creatureTypes.own.join(', ') || 'None'}</p><p>Referenced: {auto.creatureTypes.referenced.join(', ') || 'None'}</p><p>Synergy: {auto.creatureTypes.synergy.join(', ') || 'None'}</p></details>}
  {override.suppressed.length > 0 && <div className="hidden-tags"><h4>Hidden by you</h4>{override.suppressed.map(id=><details className="tag-evidence" key={id}><summary>{tagDefinition(id)?.label || id} · Hidden by you · Why this tag?</summary><div>{auto?.assignments.find(a=>a.tagId===id)?.evidence.map((e,i)=><blockquote key={i}><strong>{e.face || e.field}</strong><p>{e.snippet}</p><p>{e.reason}</p></blockquote>) || <p>No automatic evidence in the current ruleset.</p>}</div></details>)}</div>}
  {error && <p role="alert">{error}</p>}
  {editing && <div className="tag-editor" aria-label="Edit Tags">
    <label>Find a tag<input type="search" value={query} onChange={e=>setQuery(e.target.value)} /></label>
    <p>Hide an automatic result, add your own, or restore automatic behavior. Changes are saved on this device.</p>
    <div className="tag-edit-options">{options.filter(t=>`${t.label} ${t.aliases?.join(' ')||''}`.toLowerCase().includes(query.toLowerCase())).map(t=>{
     const automatic=auto?.assignments.some(a=>a.tagId===t.id), added=override.added.includes(t.id), hidden=override.suppressed.includes(t.id);
     return <div className="tag-edit-row" key={t.id}><span>{t.label}<small>{hidden?'Hidden by you':added?'Added by you':automatic?'Auto':'Not assigned'}</small></span>
      {hidden || added ? <button className="text-button" disabled={busy} aria-label={`Restore automatic ${t.label}`} onClick={()=>save({added:override.added.filter(id=>id!==t.id),suppressed:override.suppressed.filter(id=>id!==t.id)})}>Restore automatic</button>
       : automatic ? <button className="text-button" disabled={busy} aria-label={`Hide ${t.label}`} onClick={()=>save({...override,suppressed:[...override.suppressed,t.id]})}>Hide</button>
       : <button className="text-button" disabled={busy} aria-label={`Add manually ${t.label}`} onClick={()=>save({suppressed:override.suppressed.filter(id=>id!==t.id),added:[...override.added,t.id]})}>Add manually</button>}
     </div>;
    })}</div>{busy && <p role="status">Saving your tags…</p>}
  </div>}

 </section>;
}
