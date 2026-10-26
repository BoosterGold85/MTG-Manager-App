import { suggestReplacements } from "../synergy/replacements";
import { candidateSummary } from "../synergy/summary";
import { ScoreBreakdown } from "./ScoreBreakdown";
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
  const comparisonFit = comparison
    ? cardSynergy(dna, comparison.card)
    : undefined;
  const suggestions = useMemo(
    () => (candidate ? suggestReplacements(candidate.synergy, dna) : []),
    [candidate, dna],
  );
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
        Ranked by final Synergy score, then confidence and verified interaction.
        Cards already in this deck or outside its Commander colors are excluded.
      </p>
      <p className="muted">
        Deck fit includes role needs and efficiency. Comparing never changes
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
            <option value="all">All owned — highest Synergy first</option>
            <option value="available">Available copies only</option>
            <option value="assigned">Fully assigned copies only</option>
          </select>
        </label>
      </div>
      <p role="status">
        {results.length} {results.length === 1 ? "candidate" : "candidates"}
      </p>
      {results.length > 0 && !results.some((c) => c.synergy.score >= 50) && (
        <p>
          No candidates reach 50 in this deck profile. Expand Other Legal Cards
          to inspect lower-scoring options.
        </p>
      )}
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
            Candidate: {candidate.card.name} · Synergy {candidate.synergy.score}{" "}
            — {candidate.synergy.band}
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
          <section aria-label="Potential replacements">
            <h4>Potential comparisons</h4>
            <p>
              Based on the local Synergy heuristic, not guaranteed upgrades.
              Nothing is swapped or removed.
            </p>
            {suggestions.length ? (
              suggestions.map((suggestion) => (
                <div key={suggestion.identity}>
                  <p>
                    <strong>{suggestion.name}</strong> · Confidence:{" "}
                    {suggestion.confidence}
                  </p>
                  <p>{suggestion.reasons.join(" ")}</p>
                  <button
                    className="management-button"
                    onClick={() => {
                      const row = rows.find(
                        (r) =>
                          r.card.oracleId === suggestion.identity ||
                          dna.byName[
                            r.name.normalize("NFKC").trim().toLowerCase()
                          ] === suggestion.identity,
                      );
                      if (row) setAgainst(row.key);
                    }}
                  >
                    Compare against {suggestion.name}
                  </button>
                </div>
              ))
            ) : (
              <p>
                No sufficiently confident, role-compatible replacement was
                identified. You can still choose a comparison below.
              </p>
            )}
          </section>
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
              {comparisonFit && (
                <>
                  <section aria-label="Heuristic comparison delta">
                    <h4>
                      Local Synergy difference:{" "}
                      {candidate.synergy.score - comparisonFit.score > 0
                        ? "+"
                        : ""}
                      {candidate.synergy.score - comparisonFit.score}
                    </h4>
                    <p>
                      A difference in local deck fit, not a universal power
                      rating or a guaranteed upgrade. Review roles and mana
                      before making any change.
                    </p>
                    <dl className="comparison-deltas">
                      {candidate.synergy.components
                        .slice(0, 6)
                        .map((component, index) => (
                          <div key={component.label}>
                            <dt>{component.label}</dt>
                            <dd>
                              {component.points} vs{" "}
                              {comparisonFit.components[index]?.points || 0}
                            </dd>
                          </div>
                        ))}
                    </dl>
                  </section>
                  <InThisDeck synergy={comparisonFit} />
                </>
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
      {(["Recommended", "Worth Considering", "Other Legal Cards"] as const).map(
        (tier) => {
          const group = results.filter((c) => c.synergy.tier === tier);
          if (!group.length) return null;
          const list = (
            <ul className="synergy-candidates">
              {group.slice(0, limit).map((c) => (
                <li key={c.identity} data-fit={c.synergy.tier}>
                  <button
                    className="synergy-art deck-art-button"
                    aria-label={`View ${c.card.name} details`}
                    onClick={() => setDetail(c.card)}
                  >
                    <CardImage card={c.card} />
                  </button>
                  <div>
                    <h3>
                      {c.card.name}{" "}
                      <span>
                        Synergy {c.synergy.score} — {c.synergy.band}
                      </span>
                    </h3>
                    <p>
                      {c.available > 0
                        ? `Available ${c.available} · Owned ${c.owned}`
                        : `Owned ${c.owned} · Available 0`}
                    </p>
                    {c.usage.length > 0 && (
                      <p>
                        Used in:{" "}
                        {c.usage
                          .map((u) => `${u.name} (${u.quantity})`)
                          .join(" · ")}
                      </p>
                    )}
                    {c.synergy.recommendation && (
                      <p>Confidence: {c.synergy.recommendation.confidence}</p>
                    )}
                    <p className="candidate-summary">
                      {candidateSummary(c.synergy, dna.strategyProfile)}
                    </p>
                    <ScoreBreakdown synergy={c.synergy} />
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
                          {card.ownership!.finish} · {card.ownership!.language}{" "}
                          · {card.ownership!.binderName || "No binder"} ·
                          Available {card.ownership!.quantityUnassigned} / Owned{" "}
                          {card.quantity}
                        </p>
                      ))}
                    </details>
                  </div>
                </li>
              ))}
            </ul>
          );
          return tier === "Other Legal Cards" ? (
            <details key={tier} className="other-legal-cards">
              <summary>Other Legal Cards · {group.length}</summary>
              <p>
                Scores below 50. These cards are color-compatible options, not
                primary recommendations.
              </p>
              {list}
            </details>
          ) : (
            <section key={tier} aria-label={tier}>
              <h3>
                {tier} · {group.length}
              </h3>
              {list}
            </section>
          );
        },
      )}
      {["Recommended", "Worth Considering", "Other Legal Cards"].some(
        (tier) => results.filter((c) => c.synergy.tier === tier).length > limit,
      ) && (
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
