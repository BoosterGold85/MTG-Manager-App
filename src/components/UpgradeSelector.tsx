import { useEffect, useMemo, useRef, useState } from "react";
import "./UpgradeSelector.css";
import type { CardMetadata, CollectionState } from "../models/collection";
import type { Deck } from "../models/deck";
import { deckDnaInput } from "../dna/engine";
import { deckIdentity } from "../decks/decks";
import { candidateGroups } from "../upgrades";
import { cardKeywords, oracleText } from "../utils/cardKeywords";
import { AXIS_LABELS, CREATIVITY_AXES, findUpgradeSelections } from "../upgradeSelector/scoring";
import type { CandidateRow, SelectorCard, SelectorResult } from "../upgradeSelector/scoring";
import { refreshSelectorMeta } from "../upgradeSelector/metadata";
import type { SelectorMeta } from "../upgradeSelector/metadata";

// Read-only. Nothing here writes a deck, moves a copy or feeds any score elsewhere in the app.
type Phase = "idle" | "loading" | "ready" | "error";

/** Maps app card metadata into the selector's pure input. Release and rank come from the selector cache. */
function toSelectorCard(card: CardMetadata, meta?: SelectorMeta): SelectorCard {
  return {
    scryfallId: card.scryfallId,
    name: card.name,
    typeLine: card.typeLine,
    oracleText: oracleText(card),
    manaValue: card.manaValue,
    colorIdentity: [...card.colorIdentity],
    keywords: cardKeywords(card),
    power: card.power,
    toughness: card.toughness,
    releasedAt: meta?.releasedAt,
    edhrecRank: meta?.edhrecRank,
  };
}

const pct = (value: number, max: number) => `${Math.round((value / max) * 100)}%`;

function AxisBars({ row }: { row: CandidateRow }) {
  return (
    <dl className="selector-axes" aria-label={`${row.card.name} score breakdown`}>
      {CREATIVITY_AXES.map((axis) => (
        <div key={axis} className="selector-axis">
          <dt>{AXIS_LABELS[axis]}</dt>
          <dd>
            <span className="selector-bar" aria-hidden="true">
              <span style={{ width: pct(row.score.axes[axis], 3) }} />
            </span>
            <span>{row.score.axes[axis]} / 3</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function NicheGem({ row }: { row: CandidateRow }) {
  return (
    <article className="selector-gem-card">
      <h4>{row.card.name}</h4>
      <p className="meta-text">
        {row.card.typeLine}
        {row.card.releasedAt ? ` · Released ${row.card.releasedAt.slice(0, 4)}` : ""}
        {row.card.edhrecRank != null ? ` · EDHREC #${row.card.edhrecRank}` : ""}
      </p>
      <p className="prose">{row.card.oracleText}</p>
      <AxisBars row={row} />
      <p className="meta-text">
        Total {row.score.total} / {row.score.maxTotal}
      </p>
      {row.score.notes.map((note) => (
        <p key={note} className="meta-text">
          {note}
        </p>
      ))}
    </article>
  );
}

export function UpgradeSelector({ state, deck }: { state: CollectionState; deck: Deck }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [meta, setMeta] = useState<Map<string, SelectorMeta>>(new Map());
  const [interrupted, setInterrupted] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);

  // Abort any in-flight lookup on unmount, and reset when the deck or saved revision changes.
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    controller.current?.abort();
    setPhase("idle");
    setMeta(new Map());
    setInterrupted(false);
    setError("");
  }, [deck.id, deck.modifiedAt, state.revision]);

  const run = async () => {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setPhase("loading");
    setError("");
    try {
      const ids = [
        ...deckDnaInput(state, deck).cards.map((c) => c.card.scryfallId),
        ...candidateGroups(state, deck).map((g) => g.canonical.scryfallId),
      ];
      const refreshed = await refreshSelectorMeta(ids, { signal: abort.signal });
      if (abort.signal.aborted) return;
      setMeta(refreshed.meta);
      setInterrupted(refreshed.interrupted);
      setPhase("ready");
    } catch (failure) {
      if (abort.signal.aborted) return;
      setError(failure instanceof Error ? failure.message : "Upgrade Selector could not load card metadata.");
      setPhase("error");
    }
  };

  // Computed only once metadata is loaded, so every ranking reads the same release and rank data.
  const result: SelectorResult | null = useMemo(() => {
    if (phase !== "ready") return null;
    const input = deckDnaInput(state, deck);
    return findUpgradeSelections({
      deckCards: input.cards.map((c) => ({ card: toSelectorCard(c.card, meta.get(c.card.scryfallId)), quantity: c.quantity, commander: c.commander })),
      candidates: candidateGroups(state, deck).map((g) => toSelectorCard(g.canonical, meta.get(g.canonical.scryfallId))),
      commanderIdentity: deckIdentity(deck),
    });
  }, [phase, state, deck, meta]);

  if (!result) {
    return (
      <section className="overview-block upgrade-selector" aria-label="Upgrade Selector" aria-busy={phase === "loading"}>
        <h2>Upgrade Selector</h2>
        <p className="meta-text">
          Finds owned cards that fit this deck's engine and rewards creative, rarely played options. Read-only: it never changes this deck or your collection.
        </p>
        {phase === "loading" && <p className="meta-text">Loading card release dates and EDHREC ranks…</p>}
        {error && (
          <p role="alert" className="meta-text">
            {error} Your collection is unchanged.
          </p>
        )}
        <button className="management-button" disabled={phase === "loading"} onClick={() => void run()}>
          Find Upgrades
        </button>
      </section>
    );
  }

  const gem = result.nicheGem;
  return (
    <section className="overview-block upgrade-selector" aria-label="Upgrade Selector">
      <h2>Upgrade Selector</h2>
      {interrupted && (
        <p role="status" className="meta-text">
          Some release dates or ranks could not be loaded, so Obscurity is provisional for those cards.
        </p>
      )}
      <div className="selector-theme">
        <h3>Theme</h3>
        {result.engine.patterns.length ? (
          <p className="prose">
            The engine is {result.engine.patterns.map((p) => `${p.label} (${result.engine.counts[p.id]} card hits)`).join(" and ")}.
          </p>
        ) : (
          <p className="prose">No clear engine: fewer than three deck cards share a pattern, so engine fit and loop score 0.</p>
        )}
      </div>

      <div className="selector-swaps">
        <h3>Suggested one-for-one swaps</h3>
        {result.swaps.length ? (
          <table>
            <thead>
              <tr>
                <th scope="col">Cut</th>
                <th scope="col">Add</th>
                <th scope="col">Creativity</th>
              </tr>
            </thead>
            <tbody>
              {result.swaps.map((swap) => (
                <tr key={`${swap.cut.scryfallId}-${swap.add.scryfallId}`}>
                  <td>{swap.cut.name}</td>
                  <td>{swap.add.name}</td>
                  <td>
                    {swap.score.total} / {swap.score.maxTotal}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="meta-text">No dead slots, or no owned card that adds engine fit, to pair.</p>
        )}
        <p className="meta-text">Pairs are score-based suggestions, not a simulated evaluation of the deck.</p>
      </div>

      <div className="selector-gem">
        <h3>Niche gem</h3>
        {gem ? <NicheGem row={gem} /> : <p className="meta-text">No owned candidate is both pre-2015 and engine-fitting, so no niche gem is suggested.</p>}
      </div>

      <details>
        <summary>Top candidates ({result.top.length})</summary>
        <ol>
          {result.top.map((row) => (
            <li key={row.card.scryfallId}>
              {row.card.name}: {row.score.total} / {row.score.maxTotal}
            </li>
          ))}
        </ol>
      </details>

      {result.deadSlots.length > 0 && (
        <details>
          <summary>Dead slots: cards with no engine fit ({result.deadSlots.length})</summary>
          <ul>
            {result.deadSlots.map((row) => (
              <li key={row.card.scryfallId}>{row.card.name}</li>
            ))}
          </ul>
        </details>
      )}

      <div className="selector-ai">
        <h3>AI review</h3>
        <p className="meta-text">Not configured. The computed scores above are complete without it.</p>
      </div>

      <button className="management-button" disabled={phase === "loading"} onClick={() => void run()}>
        Refresh card data
      </button>
    </section>
  );
}
