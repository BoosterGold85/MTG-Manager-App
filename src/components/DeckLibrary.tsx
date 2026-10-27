import { deckDnaCache, cardSynergy } from '../dna/engine';
import { useMemo, useState } from "react";
import { Crown, Plus, FileUp } from "lucide-react";
import { DeckHeader } from "./DeckHeader";
import type { DeckTab } from "../decks/workspace";
import { DeckOverview } from "./DeckOverview";
import { DeckCards } from "./DeckCards";
import { DeckUpgrades } from "./DeckUpgrades";
import { DeckSettings } from "./DeckSettings";
import type { CollectionState } from "../models/collection";
import { collectionCards, emptyCollection } from "../models/collection";
import type { Deck, DeckCommander } from "../models/deck";
import { DeckImport } from "./DeckImport";
import { CardDetail } from "./CardDetail";
import type { Override } from "../intelligence/types";
import {
  deckCardAnalysis,
  deckRows,
  emptyDeckFilters,
  visibleDeckRows,
} from "../decks/deckBrowse";
import type { DeckFilters, DeckSort } from "../decks/deckBrowse";
import { effectiveAssignments } from "../intelligence/tagger";
import type { SampleCollectionCard } from "../models/card";
import {
  allocationConflicts,
  commanderEligible,
  deckIdentity,
  deckOwnership,
  deckUsage,
} from "../decks/decks";
import type { DeckChange, DeckRepository } from "../storage/deckRepository";
import { Dialog } from "./Dialog";
import { CardImage } from "./CardImage";
import { emptyFilters, filterCards } from "../utils/filters";
import type { Filters } from "../utils/filters";
const identityLabel = (deck: Deck) =>
  deckIdentity(deck).join(" / ") || "Colorless";
export function DeckLibrary({
  state,
  repository,
  onSaved,
  activeId,
  tab,
  onTab,
  onOpen,
  onCollection,
  onSaveTags,
}: {
  state: CollectionState | null;
  repository: DeckRepository;
  onSaved: (state: CollectionState) => void;
  activeId: string | null;
  tab: DeckTab;
  onTab: (tab: DeckTab) => void;
  onOpen: (id: string | null) => void;
  onCollection: () => void;
  onSaveTags?: (card: SampleCollectionCard, override: Override) => Promise<void>;
}) {
  const [modal, setModal] = useState<"create" | null>(null);
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>({ ...emptyFilters });
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [sort, setSort] = useState<DeckSort>("type");
  const [deckFilters, setDeckFilters] = useState<DeckFilters>(emptyDeckFilters);
  // Card Detail opened from the deck: a browsable row, or a commander (outside the 99).
  const [detail, setDetail] = useState<{ row: string } | { commander: number } | null>(null);
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
    const o = deckOwnership(d, state);
    return d.entries
      ? `${o.total} cards · ${o.assigned} copies assigned · ${o.missing} missing${o.basic ? ` · ${o.basic} basic lands (not allocated)` : ""}`
      : `${o.total} cards`;
  };
  const conflicts = state ? allocationConflicts(state) : [];
  const rows = useMemo(() => (state && deck ? deckRows(state, deck) : []), [state, deck]);
  const dna=useMemo(()=>state&&deck?deckDnaCache.get(state,deck):null,[state,deck]);
  // The exact sequence shown in the grid is the Previous/Next sequence.
  const visible = useMemo(() => visibleDeckRows(rows, sort, deckFilters,dna||undefined), [rows, sort, deckFilters,dna]);
  const commanderDetailCard = (c: DeckCommander): SampleCollectionCard => {
    if (c.itemId) return cardFor(c.itemId);
    const card = state!.metadata[c.scryfallId];
    const analysis = deckCardAnalysis(state!, card);
    const tagOverrides = state!.intelligence?.overrides[analysis.cardIdentity];
    return { ...card, id: `commander:${c.scryfallId}`, quantity: 0, analysis, tagOverrides, intelligentTags: effectiveAssignments(analysis, tagOverrides).map((a) => a.tagId) };
  };
  // One shared write path for every section: one repository transaction, one status message.
  async function change(action: DeckChange, success = ""): Promise<boolean> {
    if (!state || busy) return false;
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
      }
      if (action.type === "delete") onOpen(null);
      setStatus(success);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the deck. Retry.");
      return false;
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
                Import an existing deck now — cards you don’t own are kept as
                missing, never faked. Or build one with New Deck from an owned
                commander and assign physical copies.
              </p>
              {!cards.length && (
                <p>
                  New Deck and copy assignments need your imported collection;
                  sample cards can’t be assigned. Import Deck works either way.
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
                        : deckOwnership(d, state).missing
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
      ) : state ? (
        <>
          <DeckHeader
            state={state}
            deck={deck}
            tab={tab}
            onTab={(next) => {
              setError("");
              setStatus("");
              onTab(next);
            }}
            onBack={() => {
              onOpen(null);
              reset();
              setDetail(null);
              setDeckFilters(emptyDeckFilters());
            }}
          />
          {tab === "overview" && (
            <DeckOverview
              state={state}
              deck={deck}
              dna={dna}
              commanderCard={(i) => commanderCard(deck.commanders[i])}
              onCommander={(i) => setDetail({ commander: i })}
              onViewTheme={(theme) => {
                setDeckFilters({ ...emptyDeckFilters(), theme });
                onTab("cards");
              }}
            />
          )}
          {tab === "cards" && (
            <DeckCards
              state={state}
              deck={deck}
              dna={dna}
              rows={rows}
              visible={visible}
              sort={sort}
              onSort={setSort}
              filters={deckFilters}
              onFilters={setDeckFilters}
              busy={busy}
              change={change}
              onOpen={(row) => setDetail({ row })}
            />
          )}
          {tab === "upgrades" && <DeckUpgrades key={deck.id} state={state} deck={deck} busy={busy} error={error} change={change} />}
          {tab === "settings" && <DeckSettings key={deck.id} state={state} deck={deck} busy={busy} change={change} />}
        </>
      ) : null}
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
                {step === 1 ? "Name your deck" : "Choose your commander"}
            </h2>
          </div>
          <div className="deck-dialog-content">
            {step === 1 && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (name.trim()) {
                    setStep(2);
                    setQuery("");
                  }
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
                  Choose Commander
                </button>
              </form>
            )}
            {step === 2 && (
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
            reset();
            setStatus("Deck imported. Collection quantities are unchanged.");
          }}
        />
      )}
      {detail && deck && state && (() => {
        if ("commander" in detail) {
          const c = deck.commanders[detail.commander];
          if (!c) return null;
          const card = commanderDetailCard(c);
          return (
            <CardDetail
              card={card}
              collection={state}
              onOpenDeck={(id) => { setDetail(null); onOpen(id); }}
              onClose={() => setDetail(null)}
              onSaveTags={card.ownership && onSaveTags ? (o) => onSaveTags(card, o) : undefined}
              deck={{ deckName: deck.name, quantity: 1, assigned: !!c.itemId, ownedElsewhere: 0, availableElsewhere: 0, commander: true }}
            />
          );
        }
        const index = visible.findIndex((r) => r.key === detail.row);
        if (index < 0) return null;
        const row = visible[index];
        return (
          <CardDetail
            card={row.card}
            synergy={dna?cardSynergy(dna,row.card):undefined}
            collection={state}
            onOpenDeck={(id) => { setDetail(null); onOpen(id); }}
            onClose={() => setDetail(null)}
            onSaveTags={row.card.ownership && onSaveTags ? (o) => onSaveTags(row.card, o) : undefined}
            extra={
              row.assigned && row.itemId ? (
                <section className="deck-card-actions" aria-label="Deck card actions">
                  <button
                    className="management-button"
                    disabled={busy}
                    onClick={() => void change({ type: "remove", deckId: deck.id, itemId: row.itemId! }, "Copy returned to Available. Collection ownership is unchanged.")}
                  >
                    Remove one {row.card.name}
                  </button>
                  <p className="meta-text">Removing returns the copy to Available; Collection and ManaBox are unchanged.</p>
                  {(error || status) && <p role="status">{error || status}</p>}
                </section>
              ) : undefined
            }
            deck={{ deckName: deck.name, quantity: row.quantity, assigned: row.assigned, basicLand: row.basicLand, ownedElsewhere: row.ownedElsewhere, availableElsewhere: row.availableElsewhere }}
            navigation={{
              position: index + 1,
              total: visible.length,
              onPrevious: index > 0 ? () => setDetail({ row: visible[index - 1].key }) : undefined,
              onNext: index < visible.length - 1 ? () => setDetail({ row: visible[index + 1].key }) : undefined,
            }}
          />
        );
      })()}
    </section>
  );
}
