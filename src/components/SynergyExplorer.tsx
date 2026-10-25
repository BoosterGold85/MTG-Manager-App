import { useEffect, useMemo, useRef, useState } from "react";
import type { CollectionState } from "../models/collection";
import type { Deck } from "../models/deck";
import { exploreSynergy } from "../synergy/explorer";
import { cardSynergy, deckDnaCache } from "../dna/engine";
import { deckRows } from "../decks/deckBrowse";
import { Dialog } from "./Dialog";
import { CardImage } from "./CardImage";
import { CardDetail } from "./CardDetail";
import { InThisDeck } from "./InThisDeck";
import type { SampleCollectionCard } from "../models/card";
export function SynergyExplorer({
  state,
  deck,
  onClose,
}: {
  state: CollectionState;
  deck: Deck;
  onClose: () => void;
}) {
  const candidates = useMemo(() => exploreSynergy(state, deck), [state, deck]);
  const dna = useMemo(() => deckDnaCache.get(state, deck), [state, deck]);
  const rows = useMemo(
    () =>
      deckRows(state, deck)
        .filter(
          (row, index, all) =>
            all.findIndex((r) => r.name === row.name) === index,
        )
        .sort((a, b) => a.name.localeCompare(b.name, "en")),
    [state, deck],
  );
  const [query, setQuery] = useState(""),
    [availability, setAvailability] = useState("all"),
    [selected, setSelected] = useState(""),
    [against, setAgainst] = useState(""),
    [detail, setDetail] = useState<SampleCollectionCard | null>(null),
    [limit, setLimit] = useState(40);
  const results = candidates.filter(
    (c) =>
      (availability === "all" ||
        (availability === "available" ? c.available > 0 : c.available === 0)) &&
      c.card.name
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
  );
  const comparisonRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (selected && !detail) {
      comparisonRef.current?.scrollIntoView({ block: "start" });
      comparisonRef.current?.focus();
    }
  }, [selected, detail]);
  const candidate = candidates.find((c) => c.identity === selected),
    comparison = rows.find((r) => r.key === against);
  if (detail)
    return (
      <CardDetail
        card={detail}
        collection={state}
        onClose={() => setDetail(null)}
      />
    );
  return (
    <Dialog
      titleId="synergy-title"
      onClose={onClose}
      className="synergy-dialog"
    >
      <p className="eyebrow">EXPLORE SYNERGY · {deck.name}</p>
      <h2 id="synergy-title">Upgrades I Own</h2>
      <p>
        Available copies rank first, then Synergy. Cards already in this deck
        or outside its Commander colors are excluded.
      </p>
      <p className="muted">
        Theme fit, not power or a guaranteed upgrade. Comparing never changes
        your deck or moves copies. Other Commander legality rules are not fully
        validated.
      </p>
      <div className="synergy-controls">
        <label>
          Search owned candidates
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(40);
            }}
          />
        </label>
        <label>
          Copy availability
          <select
            value={availability}
            onChange={(e) => {
              setAvailability(e.target.value);
              setLimit(40);
            }}
          >
            <option value="all">All owned — available first</option>
            <option value="available">Available copies only</option>
            <option value="assigned">Fully assigned copies only</option>
          </select>
        </label>
      </div>
      <p role="status">
        {results.length} {results.length === 1 ? "candidate" : "candidates"}
      </p>
      {!results.length && (
        <p>
          No owned candidates match. Try another search or import more of your
          collection.
        </p>
      )}
      {candidate && (
        <section
          ref={comparisonRef}
          tabIndex={-1}
          className="synergy-comparison"
          aria-label="Candidate comparison"
        >
          <h3>
            Candidate: {candidate.card.name} · Synergy {candidate.synergy.score}
          </h3>
          <p>
            Available: {candidate.available} · Owned: {candidate.owned}
          </p>
          <p>
            Mana value {candidate.card.manaValue} · {candidate.card.typeLine}
          </p>
          <p>{candidate.card.oracleText}</p>
          <button
            className="management-button"
            onClick={() => setDetail(candidate.card)}
          >
            View candidate card details
          </button>
          <label>
            Compare with a card in this deck
            <select
              value={against}
              onChange={(e) => setAgainst(e.target.value)}
            >
              <option value="">Choose a deck card</option>
              {rows.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <InThisDeck synergy={candidate.synergy} />
          {comparison && (
            <section aria-label="Current deck card">
              <h3>Currently in deck: {comparison.name}</h3>
              <p>
                Mana value {comparison.card.manaValue} ·{" "}
                {comparison.card.typeLine}
              </p>
              <p>{comparison.card.oracleText}</p>
              <button
                className="management-button"
                onClick={() => setDetail(comparison.card)}
              >
                View current card details
              </button>
              {cardSynergy(dna, comparison.card) && (
                <InThisDeck synergy={cardSynergy(dna, comparison.card)!} />
              )}
              <p>
                Consider roles and mana needs alongside theme fit. Choosing this
                comparison makes no deck changes.
              </p>
            </section>
          )}
          <button
            className="text-button"
            onClick={() => {
              setSelected("");
              setAgainst("");
            }}
          >
            Close comparison
          </button>
        </section>
      )}
      <ul className="synergy-candidates">
        {results.slice(0, limit).map((c) => (
          <li key={c.identity}>
            <button
              className="synergy-art deck-art-button"
              aria-label={`View ${c.card.name} details`}
              onClick={() => setDetail(c.card)}
            >
              <CardImage card={c.card} />
            </button>
            <div>
              <h3>
                {c.card.name} <span>Synergy {c.synergy.score}</span>
              </h3>
              <p>
                Available: {c.available} · Owned: {c.owned}
                {c.available === 0 ? " · No unassigned copies" : ""}
              </p>
              {c.usage.length > 0 && (
                <p>
                  Used in:{" "}
                  {c.usage.map((u) => `${u.name} (${u.quantity})`).join(" · ")}
                </p>
              )}
              <p>
                Why it fits:{" "}
                {c.synergy.connections
                  .slice(0, 3)
                  .map((con) => con.label)
                  .join(" · ") || "Limited theme evidence"}
              </p>
              {c.synergy.commanderConnections.length > 0 && (
                <p>
                  Commander connection:{" "}
                  {c.synergy.commanderConnections
                    .map((con) => con.theme)
                    .join(" · ")}
                </p>
              )}
              <details>
                <summary>
                  {c.printings.length} owned{" "}
                  {c.printings.length === 1
                    ? "printing / variant"
                    : "printings / variants"}
                </summary>
                {c.printings.map((card) => (
                  <p key={card.id}>
                    {card.setCode.toUpperCase()} #{card.collectorNumber} ·{" "}
                    {card.ownership!.finish} · {card.ownership!.language} ·{" "}
                    {card.ownership!.binderName || "No binder"} · Available{" "}
                    {card.ownership!.quantityUnassigned} / Owned {card.quantity}
                  </p>
                ))}
              </details>
              <button
                className="management-button"
                aria-pressed={selected === c.identity}
                onClick={() => {
                  setSelected(c.identity);
                  setAgainst("");
                }}
              >
                Compare {c.card.name}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {results.length > limit && (
        <button
          className="primary-button"
          onClick={() => setLimit((n) => n + 40)}
        >
          Show more candidates
        </button>
      )}
    </Dialog>
  );
}
