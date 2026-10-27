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
  const total = deckCount(deck);
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
        <span>{total >= 100 ? "Complete" : `${100 - total} to go`}</span>
        {deck.entries && <span>{ownership.missing} missing</span>}
        <span>{identityName(deck)}</span>
      </p>
      <nav className="deck-sections" aria-label="Deck sections">
        {deckTabs.map((t) => (
          <button key={t.id} className={tab === t.id ? "active" : ""} aria-current={tab === t.id ? "page" : undefined} onClick={() => onTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
