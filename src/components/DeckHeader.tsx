import { formatOf,formatLabel,targetSize } from "../decks/formats";
import { ArrowLeft } from "lucide-react";
import type { CollectionState } from "../models/collection";
import type { Deck } from "../models/deck";
import { deckCount, deckOwnership } from "../decks/decks";
import { deckTabs, identityName } from "../decks/workspace";
import type { DeckTab } from "../decks/workspace";

/** Deck identity and status only: everyday actions live in the four deck sections. */
export function DeckHeader({
  state,
  deck,
  tab,
  onTab,
  onBack,
}: {
  state: CollectionState;
  deck: Deck;
  tab: DeckTab;
  onTab: (tab: DeckTab) => void;
  onBack: () => void;
}) {
  const total = formatOf(deck)==="commander"?deckCount(deck):(deck.entries || []).filter(e=>e.board==="main").reduce((n,e)=>n+e.quantity,0);
  const target=targetSize(deck);
  const ownership = deckOwnership(deck, state);
  return (
    <header className="deck-workspace-header">
      <button className="text-button deck-back" onClick={onBack}>
        <ArrowLeft size={16} />
        All Decks
      </button>
      <h1>{deck.name}</h1>
      <p className="deck-header-commander">{deck.commanders.map((c) => c.name).join(" + ")}</p>
      <p className="deck-header-status">
        <span>{total} cards</span>
        {formatOf(deck)!=="commander" && <span>{(deck.entries || []).filter(e=>e.board==="sideboard").reduce((n,e)=>n+e.quantity,0)} sideboard</span>}
        <span>{total >= target ? (formatOf(deck)==="commander"?"Complete":"Minimum size met") : `${target - total} to go`}</span>
        {deck.entries && <span>{ownership.missing} missing</span>}
        <span>{formatOf(deck)==="commander"?identityName(deck):formatLabel(deck)}</span>
      </p>
      <nav className="deck-sections" aria-label="Deck sections">
        {deckTabs.filter(t=>formatOf(deck)==="commander" || t.id!=="upgrades").map((t) => (
          <button key={t.id} className={tab === t.id ? "active" : ""} aria-current={tab === t.id ? "page" : undefined} onClick={() => onTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
