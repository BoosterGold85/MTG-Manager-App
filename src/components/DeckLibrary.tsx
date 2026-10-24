import { useState } from "react";
import { Crown, Plus, ArrowLeft, Settings2, FileUp } from "lucide-react";
import type { CollectionState } from "../models/collection";
import { collectionCards, emptyCollection } from "../models/collection";
import type { Deck, DeckCommander } from "../models/deck";
import { DeckImport, DeckIssues } from "./DeckImport";
import type { SampleCollectionCard } from "../models/card";
import {
  allocationConflicts,
  commanderEligible,
  deckCount,
  deckIdentity,
  assignedCount,
  deckOwnership,
  deckStats,
  missingEntries,
  deckUsage,
  legalInDeck,
} from "../decks/decks";
import type { DeckChange, DeckRepository } from "../storage/deckRepository";
import { Dialog } from "./Dialog";
import { CardGrid } from "./CardGrid";
import { CardImage } from "./CardImage";
import { FilterDrawer } from "./FilterDrawer";
import { emptyFilters, filterCards } from "../utils/filters";
import type { Filters } from "../utils/filters";
const identityLabel = (deck: Deck) =>
  deckIdentity(deck).join(" / ") || "Colorless";
export function DeckLibrary({
  state,
  repository,
  onSaved,
  activeId,
  onOpen,
  onCollection,
}: {
  state: CollectionState | null;
  repository: DeckRepository;
  onSaved: (state: CollectionState) => void;
  activeId: string | null;
  onOpen: (id: string | null) => void;
  onCollection: () => void;
}) {
  const [modal, setModal] = useState<"create" | "rename" | "delete" | null>(
    null,
  );
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>({ ...emptyFilters });
  const [filterOpen, setFilterOpen] = useState(false);
  const [tab, setTab] = useState<"deck" | "add">("deck");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [chosen, setChosen] = useState<SampleCollectionCard | null>(null);
  const [importing, setImporting] = useState(false);
  const decks = state?.decks || [];
  const deck = decks.find((d) => d.id === activeId);
  const cards = state ? collectionCards(state) : [];
  const ownedById = new Map(cards.map((c) => [c.id, c]));
  // Keep zero-owned conflicting assignments visible too.
  const cardFor = (id: string): SampleCollectionCard => {
    const item = state!.items.find((i) => i.id === id)!;
    return (
      ownedById.get(id) || {
        ...state!.metadata[item.scryfallId],
        id,
        quantity: item.quantityOwned,
        ownership: item,
        foil: item.finish !== "nonfoil",
      }
    );
  };
  // A decklist commander without an assigned copy still shows canonical art and identity.
  const commanderCard = (c: DeckCommander): SampleCollectionCard =>
    c.itemId
      ? cardFor(c.itemId)
      : { ...state!.metadata[c.scryfallId], id: `commander:${c.scryfallId}`, quantity: 0 };
  const ownershipLine = (d: Deck) => {
    const o = deckOwnership(d);
    return d.entries
      ? `${o.total} cards · ${o.assigned} owned / assigned · ${o.missing} missing`
      : `${o.total} cards`;
  };
  const conflicts = state ? allocationConflicts(state) : [];
  async function change(action: DeckChange) {
    if (!state || busy) return;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const next = await repository.change(state, action);
      onSaved(next);
      if (action.type === "create") {
        onOpen(next.decks!.at(-1)!.id);
        setModal(null);
        setQuery("");
        setTab("deck");
      }
      if (action.type === "delete") {
        onOpen(null);
        setModal(null);
      }
      if (action.type === "rename") setModal(null);
      if (action.type === "add" || action.type === "remove")
        setStatus(
          action.type === "add"
            ? "Copy added to deck."
            : "Copy returned to Available. Collection ownership is unchanged.",
        );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save the deck. Retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  const reset = () => {
    setQuery("");
    setFilters({ ...emptyFilters });
  };
  const search = (label: string) => (
    <div className="deck-search">
      <label>
        {label}
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <label>
        Search in
        <select
          value={filters.searchIn || "name"}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              searchIn: e.target.value as Filters["searchIn"],
            }))
          }
        >
          <option value="name">Card Name</option>
          <option value="oracle">Oracle Text</option>
          <option value="all">All</option>
        </select>
      </label>
    </div>
  );
  const allocation = (card: SampleCollectionCard) => card.ownership ? (
    <span className="allocation-copy">
      Owned {card.ownership!.quantityOwned} · Assigned{" "}
      {card.ownership!.quantityAssigned} · Available{" "}
      {card.ownership!.quantityUnassigned}
    </span>
  ) : (
    <span className="allocation-copy">Missing — no owned copy assigned</span>
  );
  const usage = (card: SampleCollectionCard) =>
    state && (
      <p className="allocation-copy">
        {deckUsage(state, card.id)
          .map((u) => `${u.deck.name} ×${u.quantity}`)
          .join(" · ") || "Not assigned to a deck"}
      </p>
    );
  const start = () => {
    setModal("create");
    setStep(1);
    setName("");
    reset();
    setError("");
  };
  return (
    <section className="deck-library">
      {!deck ? (
        <>
          <div className="deck-heading">
            <div>
              <p className="eyebrow">YOUR CARDS. YOUR CREATIONS.</p>
              <h1>
                My Decks<span className="heading-period">.</span>
              </h1>
              <p className="collection-subtitle">
                A home for the decks you keep close.
              </p>
            </div>
            <span className="deck-heading-actions">
              <button className="management-button" onClick={() => { setError(""); setImporting(true); }}>
                <FileUp size={16} />
                Import Deck
              </button>
              <button className="primary-button" onClick={start}>
                <Plus size={17} />
                New Deck
              </button>
            </span>
          </div>
          {!decks.length ? (
            <section className="empty-state">
              <Crown size={32} />
              <h2>Build your first Commander deck.</h2>
              <p>
                Choose a commander from your owned collection, then give every
                copy a home.
              </p>
              {!cards.length && (
                <p>
                  Import your collection first. Sample cards cannot be assigned.
                </p>
              )}
              <button className="management-button" onClick={onCollection}>
                Back to your collection
              </button>
            </section>
          ) : (
            <div className="deck-grid">
              {decks.map((d) => (
                <button
                  className="deck-card"
                  key={d.id}
                  onClick={() => {
                    onOpen(d.id);
                    setTab("deck");
                    reset();
                    setError("");
                    setStatus("");
                  }}
                >
                  <div className="deck-cover">
                    <CardImage card={commanderCard(d.commanders[0])} />
                  </div>
                  <div className="deck-card-copy">
                    <h2>{d.name}</h2>
                    <p>{d.commanders.map((c) => c.name).join(" + ")}</p>
                    <p>
                      {identityLabel(d)} · {ownershipLine(d)}
                    </p>
                    <p>
                      {[...d.commanders, ...d.assignments].some((a) =>
                        conflicts.some((i) => i.id === a.itemId),
                      )
                        ? "Allocation needs reconciliation"
                        : deckOwnership(d).missing
                          ? "Some decklist cards have no assigned copy"
                          : "Owned copies assigned"}
                    </p>
                    <p>
                      Modified {new Date(d.modifiedAt).toLocaleDateString()}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <button
            className="text-button"
            onClick={() => {
              onOpen(null);
              reset();
              setChosen(null);
            }}
          >
            <ArrowLeft size={16} />
            All decks
          </button>
          <div className="deck-heading">
            <div>
              <p className="eyebrow">COMMANDER LIBRARY</p>
              <h1>{deck.name}</h1>
              <p className="collection-subtitle">
                {identityLabel(deck)} · {ownershipLine(deck)}
              </p>
            </div>
            <button
              className="management-button"
              onClick={() => {
                setName(deck.name);
                setModal("rename");
                setError("");
              }}
            >
              <Settings2 size={16} />
              Edit Deck
            </button>
          </div>
          <p className="deck-warning">
            Color identity is enforced. Other Commander rules, singleton limits,
            banned cards and Partner combinations are not fully validated.
          </p>
          <section aria-label="Commander" className="deck-commander">
            {deck.commanders.map((c, i) => (
              <div key={`${c.itemId || c.scryfallId}-${i}`}>
                <div className="commander-art">
                  <CardImage card={commanderCard(c)} />
                </div>
                <div>
                  <p className="eyebrow">COMMANDER</p>
                  <h2>{c.name}</h2>
                  <p>
                    {commanderCard(c).setCode.toUpperCase()} #
                    {commanderCard(c).collectorNumber}
                    {c.itemId ? ` · ${commanderCard(c).ownership!.finish}` : ""}
                  </p>
                  {allocation(commanderCard(c))}
                </div>
              </div>
            ))}
            {deck.commanders.length > 1 && (
              <p className="deck-warning">Partner/Background pairing rules are not validated.</p>
            )}
          </section>
          {(() => {
            const stats = deckStats(state!, deck);
            return (
              <details className="deck-statistics">
                <summary>Basic composition · {deckCount(deck)} cards</summary>
                <p>
                  {Object.entries(stats.counts)
                    .map(([type, count]) => `${type}: ${count}`)
                    .join(" · ")}
                </p>
                <p>Average mana value (nonlands): {stats.average.toFixed(2)}</p>
              </details>
            );
          })()}
          <div role="group" aria-label="Deck sections" className="deck-tabs">
            <button
              className={`chip ${tab === "deck" ? "selected" : ""}`}
              aria-pressed={tab === "deck"}
              onClick={() => setTab("deck")}
            >
              Deck
            </button>
            <button
              className={`chip ${tab === "add" ? "selected" : ""}`}
              aria-pressed={tab === "add"}
              onClick={() => {
                setTab("add");
                reset();
              }}
            >
              Add Cards
            </button>
          </div>
          {tab === "deck" ? (
            <section aria-label="Deck cards">
              {!deck.assignments.length && !deck.entries && (
                <p className="collection-subtitle">
                  Your commander is ready. Add cards from your collection.
                </p>
              )}
              <div className="deck-owned-grid">
                {deck.assignments.map((a) => {
                  const card = cardFor(a.itemId);
                  return (
                    <article key={`${a.itemId}-${a.entryId || ""}`} className="deck-owned-card">
                      <button
                        className="deck-art-button"
                        onClick={() => setChosen(card)}
                      >
                        <span className="sr-only">Manage {card.name}</span>
                        <CardImage card={card} />
                      </button>
                      <h3>
                        {card.name} ×{a.quantity}
                      </h3>
                      <p>
                        {card.setCode.toUpperCase()} #{card.collectorNumber} ·{" "}
                        {card.ownership!.finish} · {card.ownership!.language} ·{" "}
                        {card.ownership!.condition}
                      </p>
                      {allocation(card)}
                      <button
                        className="management-button"
                        disabled={busy}
                        onClick={() =>
                          void change({
                            type: "remove",
                            deckId: deck.id,
                            itemId: card.id,
                          })
                        }
                      >
                        Remove one {card.name}
                      </button>
                    </article>
                  );
                })}
              </div>
              <p className="allocation-copy">
                Removing a deck card returns its copy to Available. It does not
                remove it from Collection or change ManaBox.
              </p>
              {(() => {
                const missing = missingEntries(state!, deck);
                if (!missing.length) return null;
                return (
                  <section aria-label="Missing and unassigned cards" className="deck-missing">
                    <h2>Missing / Unassigned · {missing.reduce((n, m) => n + m.missing, 0)}</h2>
                    <p className="allocation-copy">
                      These decklist cards have no physical copy assigned. Ownership is never fabricated; add an
                      available copy from Add Cards to fill one.
                    </p>
                    <ul>
                      {missing.map((m) => (
                        <li key={m.entry.id}>
                          <strong>
                            {m.entry.name} ×{m.missing}
                          </strong>
                          {m.entry.board === "commander" && " · Commander"}
                          {m.entry.requestedPrinting && (
                            <span>
                              {" "}
                              · Requested {m.entry.requestedPrinting.setCode.toUpperCase()}
                              {m.entry.requestedPrinting.collectorNumber ? ` #${m.entry.requestedPrinting.collectorNumber}` : ""}
                            </span>
                          )}
                          <p className={m.outsideIdentity ? "deck-error" : "allocation-copy"}>
                            {m.reason} · Owned {m.owned} · Available {m.available}
                          </p>
                          {m.entry.board === "main" && (
                            <button
                              className="text-button"
                              disabled={busy}
                              onClick={() => void change({ type: "remove-missing", deckId: deck.id, entryId: m.entry.id })}
                            >
                              Remove one missing {m.entry.name} from decklist
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })()}
              {deck.importIssues && <DeckIssues issues={deck.importIssues} title="Rows not imported" />}
            </section>
          ) : (
            <section aria-label="Add cards from collection">
              <p className="collection-subtitle">
                Cards legal within {identityLabel(deck)} · owned printings only
              </p>
              {search("Search owned cards")}
              <button
                className="management-button"
                onClick={() => setFilterOpen(true)}
              >
                Filters
              </button>
              <div className="deck-candidates">
                <CardGrid
                  key={JSON.stringify([query, filters])}
                  cards={filterCards(
                    cards.filter((c) => legalInDeck(c, deck)),
                    query,
                    filters,
                  )}
                  loading={false}
                  onOpen={setChosen}
                  onReset={reset}
                  caption={(card) => allocation(card)}
                />
              </div>
            </section>
          )}
        </>
      )}
      {!!conflicts.length && (
        <section
          className="allocation-conflicts"
          aria-label="Allocation conflicts"
        >
          <h2>Inventory needs reconciliation</h2>
          {conflicts.map((item) => (
            <div key={item.id}>
              <p>
                {state!.metadata[item.scryfallId].name} ·{" "}
                {item.setCode.toUpperCase()} #{item.collectorNumber} ·{" "}
                {item.finish} · Owned {item.quantityOwned} · Assigned{" "}
                {item.quantityAssigned}
              </p>
              {usage(cardFor(item.id))}
            </div>
          ))}
          <p>
            Assignments were preserved. Remove excess copies from the listed
            decks, or correct your inventory and re-import.
          </p>
        </section>
      )}
      {!modal && error && (
        <p role="alert" className="deck-error">
          {error}
        </p>
      )}
      <p role="status">{status}</p>
      {modal && (
        <Dialog
          titleId="deck-modal-title"
          onClose={() => {
            if (!busy) {
              setModal(null);
              setError("");
              reset();
            }
          }}
          closeDisabled={busy}
          className="deck-dialog"
        >
          <div className="dialog-heading">
            <p className="eyebrow">COMMANDER LIBRARY</p>
            <h2 id="deck-modal-title">
              {modal === "create"
                ? step === 1
                  ? "Name your deck"
                  : "Choose your commander"
                : modal === "rename"
                  ? "Edit Deck"
                  : "Delete deck?"}
            </h2>
          </div>
          <div className="deck-dialog-content">
            {(modal === "rename" || (modal === "create" && step === 1)) && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (modal === "create") {
                    if (name.trim()) {
                      setStep(2);
                      setQuery("");
                    }
                  } else if (deck)
                    void change({ type: "rename", deckId: deck.id, name });
                }}
              >
                <label>
                  Deck name
                  <input
                    required
                    maxLength={120}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <button className="primary-button" disabled={busy}>
                  {modal === "create" ? "Choose Commander" : "Save deck name"}
                </button>
              </form>
            )}
            {modal === "create" && step === 2 && (
              <>
                <p>
                  Legendary creatures and cards explicitly allowed as
                  commanders, using canonical metadata.
                </p>
                {search("Search commanders")}
                <div className="commander-options">
                  {filterCards(
                    cards.filter(commanderEligible),
                    query,
                    filters,
                  ).map((c) => (
                    <div key={c.id}>
                      <button
                        disabled={busy || c.ownership!.quantityUnassigned < 1}
                        className="commander-option"
                        onClick={() =>
                          void change({ type: "create", name, itemId: c.id })
                        }
                      >
                        <CardImage card={c} />
                        <span>
                          <strong>{c.name}</strong>
                          <span>
                            {c.setCode.toUpperCase()} #{c.collectorNumber} ·{" "}
                            {c.ownership!.finish}
                          </span>
                          {allocation(c)}
                        </span>
                      </button>
                      {c.ownership!.quantityUnassigned < 1 && (
                        <>
                          <p>No unassigned copy available</p>
                          {usage(c)}
                        </>
                      )}
                    </div>
                  ))}
                </div>
                {!cards.some(commanderEligible) && (
                  <p>
                    No eligible owned commanders. Import a collection containing
                    a commander first.
                  </p>
                )}
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => setStep(1)}
                >
                  Back to deck name
                </button>
              </>
            )}
            {modal === "rename" && deck && (
              <button
                className="danger-button"
                onClick={() => setModal("delete")}
              >
                Delete deck
              </button>
            )}
            {modal === "delete" && deck && (
              <>
                <p>
                  Delete {deck.name}? All {assignedCount(deck)} assigned copies will
                  return to Available. Collection cards and ManaBox are
                  unchanged.
                </p>
                <button
                  className="danger-button"
                  disabled={busy}
                  onClick={() =>
                    void change({ type: "delete", deckId: deck.id })
                  }
                >
                  Confirm delete deck
                </button>
              </>
            )}
            {error && (
              <p role="alert" className="deck-error">
                {error}
              </p>
            )}
            {busy && <p role="status">Saving deck…</p>}
          </div>
        </Dialog>
      )}
      {importing && (
        <DeckImport
          state={state || emptyCollection()}
          repository={repository}
          onClose={() => setImporting(false)}
          onImported={(next, id) => {
            onSaved(next);
            setImporting(false);
            onOpen(id);
            setTab("deck");
            reset();
            setStatus("Deck imported. Collection quantities are unchanged.");
          }}
        />
      )}
      {filterOpen && deck && (
        <FilterDrawer
          cards={cards.filter((c) => legalInDeck(c, deck))}
          query={query}
          filters={filters}
          onClose={() => setFilterOpen(false)}
          onApply={(f) => {
            setFilters(f);
            setFilterOpen(false);
          }}
        />
      )}
      {chosen && deck && (
        <Dialog
          titleId="allocation-title"
          className="deck-dialog"
          onClose={() => {
            if (!busy) {
              setChosen(null);
              setError("");
            }
          }}
          closeDisabled={busy}
        >
          <div className="dialog-heading">
            <h2 id="allocation-title">{chosen.name}</h2>
          </div>
          <div className="deck-dialog-content">
            {(() => {
              const current = cardFor(chosen.id);
              const assigned = deck.assignments
                .filter((a) => a.itemId === current.id)
                .reduce((n, a) => n + a.quantity, 0);
              return (
                <>
                  <p>
                    {current.setCode.toUpperCase()} #{current.collectorNumber} ·{" "}
                    {current.ownership!.finish} · {current.ownership!.language}{" "}
                    · {current.ownership!.condition}
                  </p>
                  {allocation(current)}
                  {usage(current)}
                  {current.ownership!.quantityUnassigned < 1 && (
                    <p>No unassigned copy available</p>
                  )}
                  <button
                    className="primary-button"
                    disabled={busy || current.ownership!.quantityUnassigned < 1}
                    onClick={() =>
                      void change({
                        type: "add",
                        deckId: deck.id,
                        itemId: current.id,
                      })
                    }
                  >
                    Add one copy
                  </button>
                  {assigned > 0 && (
                    <button
                      className="management-button"
                      disabled={busy}
                      onClick={() =>
                        void change({
                          type: "remove",
                          deckId: deck.id,
                          itemId: current.id,
                        })
                      }
                    >
                      Remove one copy
                    </button>
                  )}
                  <p>
                    Copies stay in Collection. No copies are moved from other
                    decks.
                  </p>
                </>
              );
            })()}
            {error && <p role="alert">{error}</p>}
            <p role="status">{status}</p>
          </div>
        </Dialog>
      )}
    </section>
  );
}
