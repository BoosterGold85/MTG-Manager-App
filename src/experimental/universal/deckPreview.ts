import type {CollectionState} from '../../models/collection';
import type {Deck} from '../../models/deck';
/** Ephemeral hypothetical input only, including older assignment-only decks. */
export function withoutCard(state:CollectionState,deck:Deck,id:string):Deck {
 const selected=state.metadata[id];
 const matches=(other:string)=>other===id||!!selected?.oracleId&&state.metadata[other]?.oracleId===selected.oracleId;
 const entryIds=new Set(deck.entries?.filter(e=>matches(e.scryfallId)).map(e=>e.id));
 const itemIds=new Set(state.items.filter(i=>matches(i.scryfallId)).map(i=>i.id));
 return {...deck,entries:deck.entries?.filter(e=>!matches(e.scryfallId)),commanders:deck.commanders.filter(c=>!matches(c.scryfallId)),assignments:deck.assignments.filter(a=>a.entryId?!entryIds.has(a.entryId):!itemIds.has(a.itemId))};
}
