import { useState } from "react";
import { Plus, SlidersHorizontal, X } from "lucide-react";
import type { CollectionState } from "../models/collection";
import type { Deck } from "../models/deck";
import type { SampleCollectionCard } from "../models/card";
import type { DeckDna } from "../dna/engine";
import { cardSynergy } from "../dna/engine";
import { deckSortLabels, deckTypes, emptyDeckFilters, typeGroup } from "../decks/deckBrowse";
import type { DeckFilters, DeckRow, DeckSort } from "../decks/deckBrowse";
import { deckPlayable, deckUsage, legalInDeck, missingEntries } from "../decks/decks";
import { collectionCards } from "../models/collection";
import type { DeckChange } from "../storage/deckRepository";
import { emptyFilters, filterCards } from "../utils/filters";
import type { Filters } from "../utils/filters";
import { CardGrid } from "./CardGrid";
import { CardImage } from "./CardImage";
import { Dialog } from "./Dialog";
import { FilterDrawer } from "./FilterDrawer";
import { DeckIssues } from "./DeckImport";
import { identityName } from "../decks/workspace";

const ownershipLabels = { assigned: "Owned / assigned", missing: "Missing / unassigned" } as const;
/** Cards answers "what is in this deck?": scan, filter, open details, add or remove cards. */
export function DeckCards({
  state,
  deck,
  dna,
  rows,
  visible,
  sort,
  onSort,
  filters,
  onFilters,
  busy,
  change,
  onOpen,
}: {
  state: CollectionState;
  deck: Deck;
  dna: DeckDna | null;
  rows: DeckRow[];
  visible: DeckRow[];
  sort: DeckSort;
  onSort: (sort: DeckSort) => void;
  filters: DeckFilters;
  onFilters: (update: (f: DeckFilters) => DeckFilters) => void;
  busy: boolean;
  change: (action: DeckChange, success: string) => Promise<boolean>;
  onOpen: (rowKey: string) => void;
}) {
  const [sheet, setSheet] = useState(false);
  const [adding, setAdding] = useState(false);
  const missing = missingEntries(state, deck);
  const missingCount = missing.reduce((n, m) => n + m.missing, 0);
  const mainCount = rows.reduce((n, r) => n + r.quantity, 0);
  const themeLabel = (id: string) => dna?.themes.find((t) => t.id === id)?.label || id;
  const chips: { key: keyof DeckFilters; label: string }[] = [
    ...(filters.theme ? [{ key: "theme" as const, label: themeLabel(filters.theme) }] : []),
    ...(filters.type ? [{ key: "type" as const, label: filters.type }] : []),
    ...(filters.ownership ? [{ key: "ownership" as const, label: filters.ownership === "missing" ? "Missing" : "Owned" }] : []),
  ];
  const filtering = !!(filters.query || chips.length);
  const caption = (row: DeckRow) =>
    sort === "synergy-desc" || sort === "synergy-asc"
      ? `SYNERGY ${dna ? cardSynergy(dna, row.card)?.score || 0 : 0} · ${dna ? cardSynergy(dna, row.card)?.band || "Not Recommended" : "Not Recommended"}`
      : sort === "mv-asc" || sort === "mv-desc"
        ? `MV ${row.card.manaValue}`
        : sort === "type"
          ? typeGroup(row.card).toUpperCase()
          : sort === "color"
            ? row.card.colorIdentity.join("") || "COLORLESS"
            : sort === "set"
              ? `${row.card.setCode.toUpperCase()} #${row.card.collectorNumber || ""}`
              : null;
  return (
    <section aria-label="Deck cards" className="deck-cards">
      <div className="section-heading">
        <h2>Cards · {mainCount}</h2>
        <button className="primary-button" onClick={() => setAdding(true)}>
          <Plus size={17} />
          Add Card
        </button>
      </div>
      {missingCount > 0 && (
        <p className="deck-notice">
          {missingCount} {missingCount === 1 ? "card is" : "cards are"} missing or unassigned.{" "}
          <button className="text-button" onClick={() => onFilters((f) => ({ ...f, ownership: "missing" }))}>
            View Missing
          </button>
        </p>
      )}
      {!deck.assignments.length && !deck.entries && <p className="prose">Your commander is ready. Add cards from your collection.</p>}
      <div className="deck-browse-controls" role="group" aria-label="Sort and filter deck">
        <label className="deck-search-field">
          Search this deck
          <input type="search" value={filters.query} onChange={(e) => onFilters((f) => ({ ...f, query: e.target.value }))} />
        </label>
        <label>
          Sort
          <select value={sort} onChange={(e) => onSort(e.target.value as DeckSort)}>
            {(Object.keys(deckSortLabels) as DeckSort[]).map((key) => (
              <option key={key} value={key}>
                {deckSortLabels[key]}
              </option>
            ))}
          </select>
        </label>
        <button className="management-button" onClick={() => setSheet(true)}>
          <SlidersHorizontal size={16} />
          Filters{chips.length ? ` (${chips.length})` : ""}
        </button>
      </div>
      {chips.length > 0 && (
        <ul className="filter-chips" aria-label="Active filters">
          {chips.map((chip) => (
            <li key={chip.key}>
              <button className="chip selected" aria-label={`Remove filter: ${chip.label}`} onClick={() => onFilters((f) => ({ ...f, [chip.key]: "" }))}>
                {chip.label} <X size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="meta-text" role="status">
        {filtering ? `${visible.length} of ${rows.length} deck cards shown` : `${rows.length} deck cards`}
        {filtering && (
          <>
            {" · "}
            <button className="text-button" onClick={() => onFilters(() => emptyDeckFilters())}>
              Clear deck filters
            </button>
          </>
        )}
      </p>
      <div className="deck-owned-grid">
        {visible.map((row) => {
          const label = caption(row);
          return (
            <article key={row.key} className={`deck-owned-card${row.assigned ? "" : " deck-card-missing"}`}>
              <button className="deck-art-button" aria-label={`Open ${row.card.name} details`} onClick={() => onOpen(row.key)}>
                <CardImage card={row.card} />
              </button>
              {label && <p className="deck-sort-metric">{label}</p>}
              <h3>
                {row.card.name} ×{row.quantity}
              </h3>
              {!row.assigned && <p className={row.basicLand ? "meta-text" : "missing-badge"}>{row.basicLand ? "Basic land" : "Missing"}</p>}
            </article>
          );
        })}
      </div>
      {filtering && !visible.length && <p className="prose">No deck cards match these filters.</p>}
      <p className="meta-text">Open a card to remove it. Removing a deck card returns its copy to Available; it does not remove it from Collection or change ManaBox.</p>
      {missing.length > 0 && (
        <section aria-label="Missing and unassigned cards" className="deck-missing">
          <h2>Missing / Unassigned · {missingCount}</h2>
          <p className="meta-text">
            These decklist cards have no physical copy assigned. Ownership is never fabricated; add an available copy with Add Card to
            fill one.
          </p>
          <ul>
            {missing.map((m) => (
              <li key={m.entry.id}>
                <strong>
                  {m.entry.name} ×{m.missing}
                </strong>
                {m.entry.board === "commander" && " · Commander"}
                {m.entry.requestedPrinting && (
                  <span className="meta-text">
                    {" "}
                    · Requested {m.entry.requestedPrinting.setCode.toUpperCase()}
                    {m.entry.requestedPrinting.collectorNumber ? ` #${m.entry.requestedPrinting.collectorNumber}` : ""}
                  </span>
                )}
                <p className={m.outsideIdentity ? "deck-error" : "meta-text"}>
                  {m.reason} · Owned {m.owned} · Available {m.available}
                </p>
                {m.entry.board === "main" && (
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => void change({ type: "remove-missing", deckId: deck.id, entryId: m.entry.id }, `${m.entry.name} removed from the decklist.`)}
                  >
                    Remove one missing {m.entry.name} from decklist
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {deck.importIssues && <DeckIssues issues={deck.importIssues} title="Rows not imported" />}
      {sheet && (
        <Dialog titleId="deck-filter-title" className="deck-dialog" onClose={() => setSheet(false)}>
          <div className="dialog-heading">
            <h2 id="deck-filter-title">Filter deck cards</h2>
          </div>
          <div className="deck-dialog-content deck-filter-sheet">
            {dna && (
              <label>
                Deck DNA theme
                <select value={filters.theme || ""} onChange={(e) => onFilters((f) => ({ ...f, theme: e.target.value }))}>
                  <option value="">All themes</option>
                  {dna.themes.map((theme) => (
                    <option key={theme.id} value={theme.id}>
                      {theme.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Card type
              <select value={filters.type} onChange={(e) => onFilters((f) => ({ ...f, type: e.target.value as DeckFilters["type"] }))}>
                <option value="">All types</option>
                {[...deckTypes, "Other" as const].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            {deck.entries && (
              <label>
                Ownership
                <select value={filters.ownership} onChange={(e) => onFilters((f) => ({ ...f, ownership: e.target.value as DeckFilters["ownership"] }))}>
                  <option value="">Owned and missing</option>
                  <option value="assigned">{ownershipLabels.assigned}</option>
                  <option value="missing">{ownershipLabels.missing}</option>
                </select>
              </label>
            )}
            <p className="meta-text" role="status">
              {visible.length} of {rows.length} deck cards match
            </p>
            <button className="primary-button" onClick={() => setSheet(false)}>
              Show cards
            </button>
          </div>
        </Dialog>
      )}
      {adding && <AddCard state={state} deck={deck} busy={busy} change={change} onClose={() => setAdding(false)} />}
    </section>
  );
}

/** Add Card is an action inside Cards: search legal owned printings, add one copy, return to the deck. */
function AddCard({
  state,
  deck,
  busy,
  change,
  onClose,
}: {
  state: CollectionState;
  deck: Deck;
  busy: boolean;
  change: (action: DeckChange, success: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>({ ...emptyFilters });
  const [filterOpen, setFilterOpen] = useState(false);
  const [chosen, setChosen] = useState<SampleCollectionCard | null>(null);
  const legal = collectionCards(state).filter((c) => legalInDeck(c, deck) && deckPlayable(c));
  const current = chosen && collectionCards(state).find((c) => c.id === chosen.id);
  const usage = (card: SampleCollectionCard) => deckUsage(state, card.id).map((u) => `${u.deck.name} ×${u.quantity}`).join(" · ") || "Not assigned to a deck";
  return (
    <Dialog titleId="add-card-title" className="deck-dialog add-card-dialog" onClose={() => !busy && onClose()} closeDisabled={busy}>
      <div className="dialog-heading">
        <p className="eyebrow">ADD CARD · {deck.name}</p>
        <h2 id="add-card-title">{current ? current.name : "Add Card"}</h2>
      </div>
      <div className="deck-dialog-content">
        {current ? (
          <>
            <p className="meta-text">
              {current.setCode.toUpperCase()} #{current.collectorNumber} · {current.ownership!.finish} · {current.ownership!.language} ·{" "}
              {current.ownership!.condition}
            </p>
            <p>
              Owned {current.ownership!.quantityOwned} · Assigned {current.ownership!.quantityAssigned} · Available {current.ownership!.quantityUnassigned}
            </p>
            <p className="meta-text">{usage(current)}</p>
            {current.ownership!.quantityUnassigned < 1 && <p>No unassigned copy available</p>}
            <button
              className="primary-button"
              disabled={busy || current.ownership!.quantityUnassigned < 1}
              onClick={async () => {
                if (await change({ type: "add", deckId: deck.id, itemId: current.id }, `${current.name} added to ${deck.name}.`)) onClose();
              }}
            >
              Add one copy
            </button>
            <button className="text-button" disabled={busy} onClick={() => setChosen(null)}>
              Back to results
            </button>
            <p className="meta-text">Copies stay in Collection. No copies are moved from other decks.</p>
          </>
        ) : (
          <>
            <p className="meta-text">Cards legal within {identityName(deck)} · owned printings only</p>
            <div className="deck-search">
              <label>
                Search owned cards
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
              </label>
              <label>
                Search in
                <select value={filters.searchIn || "name"} onChange={(e) => setFilters((f) => ({ ...f, searchIn: e.target.value as Filters["searchIn"] }))}>
                  <option value="name">Card Name</option>
                  <option value="oracle">Oracle Text</option>
                  <option value="all">All</option>
                </select>
              </label>
            </div>
            <button className="management-button" onClick={() => setFilterOpen(true)}>
              Filters
            </button>
            <div className="deck-candidates">
              <CardGrid
                key={JSON.stringify([query, filters])}
                cards={filterCards(legal, query, filters)}
                loading={false}
                onOpen={setChosen}
                onReset={() => {
                  setQuery("");
                  setFilters({ ...emptyFilters });
                }}
                caption={(card) => (
                  <span className="allocation-copy">
                    {card.ownership ? `Available ${card.ownership.quantityUnassigned} · Owned ${card.ownership.quantityOwned}` : ""}
                  </span>
                )}
              />
            </div>
          </>
        )}
      </div>
      {filterOpen && (
        <FilterDrawer
          cards={legal}
          query={query}
          filters={filters}
          onClose={() => setFilterOpen(false)}
          onApply={(f) => {
            setFilters(f);
            setFilterOpen(false);
          }}
        />
      )}
    </Dialog>
  );
}
