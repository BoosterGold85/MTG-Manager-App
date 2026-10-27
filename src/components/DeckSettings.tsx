import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { CollectionState } from "../models/collection";
import type { Deck } from "../models/deck";
import { assignedCount, deckOwnership } from "../decks/decks";
import type { DeckChange } from "../storage/deckRepository";
import { Dialog } from "./Dialog";
import { DeckIssues } from "./DeckImport";
import { identityName } from "../decks/workspace";

/** Settings: managing the deck itself, with destructive actions kept out of everyday navigation. */
export function DeckSettings({
  state,
  deck,
  busy,
  change,
}: {
  state: CollectionState;
  deck: Deck;
  busy: boolean;
  change: (action: DeckChange, success: string) => Promise<boolean>;
}) {
  const [name, setName] = useState(deck.name);
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="deck-settings">
      <section className="overview-block" aria-label="Deck Name">
        <h2>Deck Name</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void change({ type: "rename", deckId: deck.id, name }, "Deck name saved.");
          }}
        >
          <label>
            Deck name
            <input required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <button className="primary-button" disabled={busy || !name.trim() || name.trim() === deck.name}>
            Save deck name
          </button>
        </form>
      </section>
      <section className="overview-block" aria-label="Commander settings">
        <h2>Commander</h2>
        <p className="prose">
          {deck.commanders.map((c) => c.name).join(" + ")} · {identityName(deck)}
        </p>
        <p className="meta-text">
          Changing the Commander isn't supported: color identity, the decklist and copy assignments all depend on it. Create a new deck or
          import the list again to use a different Commander.
        </p>
      </section>
      <section className="overview-block" aria-label="Decklist">
        <h2>Decklist</h2>
        {deck.source ? (
          <p className="prose">
            Imported from ManaBox text{deck.source.filename ? ` (${deck.source.filename})` : ""} on {new Date(deck.source.importedAt).toLocaleDateString()}.
          </p>
        ) : (
          <p className="prose">Built in MTG Manager from your collection.</p>
        )}
        <p className="meta-text">
          Updating an existing deck from a new list isn't supported yet. Import the updated list as a new deck from My Decks; existing decks
          are never overwritten.
        </p>
        {deck.importIssues && <DeckIssues issues={deck.importIssues} title="Rows not imported" />}
      </section>
      <section className="overview-block danger-zone" aria-label="Danger Zone">
        <h2>Danger Zone</h2>
        <p className="meta-text">Deleting returns every assigned copy to Available. Collection cards and ManaBox are unchanged.</p>
        <button className="danger-button" onClick={() => setConfirming(true)}>
          <Trash2 size={16} />
          Delete Deck
        </button>
      </section>
      {confirming && (
        <Dialog titleId="delete-deck-title" className="deck-dialog" onClose={() => !busy && setConfirming(false)} closeDisabled={busy}>
          <div className="dialog-heading">
            <h2 id="delete-deck-title">Delete deck?</h2>
          </div>
          <div className="deck-dialog-content">
            <p>
              Delete {deck.name}? All {assignedCount(deck)} assigned copies will return to Available
              {deck.entries ? ` and its ${deckOwnership(deck, state).missing} missing decklist cards are discarded` : ""}. Collection cards and
              ManaBox are unchanged.
            </p>
            <button className="danger-button" disabled={busy} onClick={() => void change({ type: "delete", deckId: deck.id }, "Deck deleted.")}>
              Confirm delete deck
            </button>
            <button className="text-button" disabled={busy} onClick={() => setConfirming(false)}>
              Keep deck
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
