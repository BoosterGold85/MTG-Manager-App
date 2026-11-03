import {useMemo,useState} from 'react';
import type {ReactNode} from 'react';
import type {CollectionState,CardMetadata} from '../models/collection';
import type {Deck} from '../models/deck';
import {swapInteractions} from '../presentation/swapInteractions';
export function LazyWhy({summary,children}:{summary:string;children:()=>ReactNode}){
 const [open,setOpen]=useState(false);
 return <details className="upgrade-why" onToggle={e=>setOpen(e.currentTarget.open)}><summary>{summary}</summary>{open&&children()}</details>;
}
export function SwapInteractions({state,deck,card,cut}:{state:CollectionState;deck:Deck;card:CardMetadata;cut:string}){
 const rows=useMemo(()=>swapInteractions(state,deck,card,cut),[state,deck,card,cut]);
 return <section aria-label="Verified interactions"><h4>How this card interacts with your deck</h4>{rows.length?<ul>{rows.map(r=><li key={r.partner}><strong>{r.partner}</strong>: {r.evidence}</li>)}</ul>:<p className="meta-text">No verified card-to-card interaction was found for this swap.</p>}</section>;
}
