import { useEffect, useMemo, useRef, useState } from "react";
import type { CollectionState } from "../models/collection";
import type { Deck } from "../models/deck";
import { deckRows } from "../decks/deckBrowse";
import {
  MIN_CURRENT_DECK_CARDS,
  buildAroundCommander,
  commanderBlueprint,
  compareSwap,
  improveCurrentDeck,
  mainDeckCount,
} from "../upgrades";
import type { BuildCandidate, UpgradeCandidate } from "../upgrades";
import type { BuildEvaluation } from "../upgrades/build";
import type { SwapResult, UpgradeEvaluation } from "../upgrades/upgrade";
import { COMPONENTS, componentLabels } from "../upgrades/upgrade";
import { Dialog } from "./Dialog";
import { CardImage } from "./CardImage";
import { CardDetail } from "./CardDetail";

type Mode = "" | "improve" | "build";
type Candidate = BuildCandidate | UpgradeCandidate;
const developerTrace = () => {
  try {
    return new URLSearchParams(location.search).has("trace");
  } catch {
    return false;
  }
};
const signed = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}`;
function Availability({ c }: { c: Candidate }) {
  return (
    <>
      <p>{c.available > 0 ? `Available ${c.available} · Owned ${c.owned}` : `Owned ${c.owned} · Available 0`}</p>
      {c.usage.length > 0 && <p>Used in: {c.usage.map((u) => `${u.name} (${u.quantity})`).join(" · ")}</p>}
    </>
  );
}
function Printings({ c }: { c: Candidate }) {
  return (
    <details>
      <summary>
        {c.printings.length} owned {c.printings.length === 1 ? "printing / variant" : "printings / variants"}
      </summary>
      {c.printings.map((card) => (
        <p key={card.id}>
          {card.setCode.toUpperCase()} #{card.collectorNumber} · {card.ownership!.finish} · {card.ownership!.language} ·{" "}
          {card.ownership!.binderName || "No binder"} · Available {card.ownership!.quantityUnassigned} / Owned {card.quantity}
        </p>
      ))}
    </details>
  );
}
function BuildSummary({ build }: { build: BuildEvaluation }) {
  return (
    <>
      <p className="upgrade-metric">
        Commander Fit: <strong>{build.fitLabel}</strong> — {build.commanderFit}
      </p>
      <details className="upgrade-why">
        <summary>Why it fits</summary>
        <ul>
          {build.fitReasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </details>
    </>
  );
}
function SwapDeltas({ swap }: { swap: SwapResult }) {
  const changed = COMPONENTS.filter((c) => swap.deltas[c] !== undefined);
  return (
    <dl className="comparison-deltas" aria-label="Component changes">
      {changed.map((c) => (
        <div key={c}>
          <dt>{componentLabels[c]}</dt>
          <dd>
            {swap.deltas[c]! > 0 ? "+" : ""}
            {swap.deltas[c]}
          </dd>
        </div>
      ))}
      {!changed.length && <p>No component changes.</p>}
    </dl>
  );
}
function Trace({ trace }: { trace: unknown }) {
  return (
    <details className="developer-trace">
      <summary>Developer trace</summary>
      <pre>{JSON.stringify(trace, null, 2)}</pre>
    </details>
  );
}
export function SynergyExplorer({ state, deck, onClose }: { state: CollectionState; deck: Deck; onClose: () => void }) {
  const count = mainDeckCount(deck);
  const canImprove = count >= MIN_CURRENT_DECK_CARDS;
  const [mode, setMode] = useState<Mode>("");
  const [query, setQuery] = useState(""),
    [availability, setAvailability] = useState("all"),
    [sort, setSort] = useState("default"),
    [selected, setSelected] = useState(""),
    [against, setAgainst] = useState(""),
    [detail, setDetail] = useState<Candidate | null>(null),
    [limit, setLimit] = useState(40);
  const trace = developerTrace();
  const blueprint = useMemo(() => commanderBlueprint(state, deck), [state, deck]);
  const build = useMemo(() => (mode === "build" ? buildAroundCommander(state, deck) : []), [mode, state, deck]);
  const improve = useMemo(() => (mode === "improve" ? improveCurrentDeck(state, deck) : []), [mode, state, deck]);
  const rows = useMemo(
    () =>
      deckRows(state, deck)
        .filter((row, index, all) => all.findIndex((r) => r.name === row.name) === index)
        .sort((a, b) => a.name.localeCompare(b.name, "en")),
    [state, deck],
  );
  const pool: Candidate[] = mode === "build" ? build : improve;
  const sorted = useMemo(() => {
    const list = [...pool];
    const name = (a: Candidate, b: Candidate) => a.card.name.localeCompare(b.card.name, "en") || a.identity.localeCompare(b.identity, "en");
    if (sort === "fit") return list.sort((a, b) => b.build.commanderFit - a.build.commanderFit || name(a, b));
    if (sort === "priority") return list.sort((a, b) => b.build.buildPriority - a.build.buildPriority || name(a, b));
    if (sort === "mv") return list.sort((a, b) => a.card.manaValue - b.card.manaValue || name(a, b));
    if (sort === "name") return list.sort(name);
    return list;
  }, [pool, sort]);
  const results = sorted.filter(
    (c) =>
      (availability === "all" || (availability === "available" ? c.available > 0 : c.available === 0)) &&
      c.card.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  const comparisonRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (selected && !detail) {
      comparisonRef.current?.scrollIntoView({ block: "start" });
      comparisonRef.current?.focus();
    }
  }, [selected, detail]);
  const candidate = improve.find((c) => c.identity === selected);
  const chosenRow = rows.find((r) => r.key === against);
  const chosenSwap = useMemo(() => {
    if (!candidate || !chosenRow) return null;
    const identity = chosenRow.card.analysis?.cardIdentity || chosenRow.card.oracleId || "";
    return compareSwap(state, deck, candidate.card, identity);
  }, [candidate, chosenRow, state, deck]);
  if (detail) {
    const upgrade = canImprove ? improveCurrentDeck(state, deck).find((c) => c.identity === detail.identity)?.upgrade : undefined;
    return (
      <CardDetail
        card={detail.card}
        collection={state}
        onClose={() => setDetail(null)}
        extra={
          <section className="upgrade-scores" aria-label="Upgrades I Own scores">
            <h3>Upgrades I Own</h3>
            <dl>
              <div>
                <dt>Commander Fit</dt>
                <dd>
                  {detail.build.fitLabel} — {detail.build.commanderFit}
                  <small>Does it belong in this Commander's strategy?</small>
                </dd>
              </div>
              <div>
                <dt>Build Priority</dt>
                <dd>
                  {detail.build.priorityLabel} — {detail.build.buildPriority}
                  <small>Should I prioritize adding it while building from scratch?</small>
                </dd>
              </div>
              <div>
                <dt>Upgrade Value</dt>
                <dd>
                  {upgrade ? `${upgrade.label} (${signed(upgrade.upgradeValue)})${upgrade.best ? ` · best swap: cut ${upgrade.best.cutName}` : ""}` : `Needs at least ${MIN_CURRENT_DECK_CARDS} cards in the deck.`}
                  <small>Would it improve this exact deck through its best one-for-one replacement?</small>
                </dd>
              </div>
            </dl>
          </section>
        }
      />
    );
  }
  return (
    <Dialog titleId="synergy-title" onClose={onClose} className="synergy-dialog">
      <p className="eyebrow">UPGRADES I OWN · {deck.name}</p>
      <h2 id="synergy-title">Upgrades I Own</h2>
      {!mode ? (
        <section className="upgrade-modes" aria-label="Choose a goal">
          <h3>What are you trying to do?</h3>
          <button className="upgrade-mode" disabled={!canImprove} onClick={() => setMode("improve")} aria-describedby="improve-help">
            <strong>Improve My Current Deck</strong>
            <span id="improve-help">
              Find cards you own that would make this exact deck better. Requires an existing deck. Primary result: Upgrade Value.
              {!canImprove && ` This deck has ${count} of 99 cards; at least ${MIN_CURRENT_DECK_CARDS} are needed.`}
            </span>
          </button>
          <button className="upgrade-mode" onClick={() => setMode("build")} aria-describedby="build-help">
            <strong>Build Around My Commander</strong>
            <span id="build-help">
              Find cards you own that naturally support {blueprint.commanders.join(" + ")} and are worth considering for a new build. Requires only a Commander.
              Primary results: Build Priority and Commander Fit.
            </span>
          </button>
        </section>
      ) : (
        <>
          <p className="upgrade-mode-line">
            <strong>{mode === "improve" ? "Improve My Current Deck" : "Build Around My Commander"}</strong>{" "}
            <button
              className="text-button"
              onClick={() => {
                setMode("");
                setSelected("");
                setAgainst("");
                setSort("default");
                setLimit(40);
              }}
            >
              Change goal
            </button>
          </p>
          {mode === "build" ? (
            <section className="blueprint" aria-label="Commander Blueprint">
              <details>
                <summary>Commander Blueprint · {blueprint.commanders.join(" + ")}</summary>
                <ul>
                  {blueprint.plan.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </details>
              <p className="muted">
                Commander Fit asks whether a card belongs in this strategy. Build Priority asks how much you would want it when building from scratch. They are
                separate on purpose.
              </p>
            </section>
          ) : (
            <p className="muted">
              Upgrade Value simulates replacing each reasonable card in this deck with the candidate and keeps the best one-for-one swap. It never changes your
              deck or moves copies, and does not solve multi-card changes.
            </p>
          )}
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
                <option value="all">All owned</option>
                <option value="available">Available copies only</option>
                <option value="assigned">Fully assigned copies only</option>
              </select>
            </label>
            <label>
              Sort
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="default">{mode === "improve" ? "Upgrade Value" : "Build Priority, then Commander Fit"}</option>
                {mode === "improve" && <option value="priority">Build Priority</option>}
                <option value="fit">Commander Fit</option>
                <option value="mv">Mana value</option>
                <option value="name">Name</option>
              </select>
            </label>
          </div>
          <p role="status">
            {results.length} {results.length === 1 ? "candidate" : "candidates"}
          </p>
          {!results.length && <p>No owned candidates match. Try another search or import more of your collection.</p>}
          {candidate && (
            <section ref={comparisonRef} tabIndex={-1} className="synergy-comparison" aria-label="Candidate comparison">
              <h3>
                {candidate.card.name} · {candidate.upgrade.label} ({signed(candidate.upgrade.upgradeValue)})
              </h3>
              {candidate.upgrade.best ? (
                <section aria-label="Best swap">
                  <h4>Best swap: cut {candidate.upgrade.best.cutName}</h4>
                  <ul>
                    {candidate.upgrade.cutReasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                  <SwapDeltas swap={candidate.upgrade.best} />
                  {candidate.upgrade.alternatives.length > 0 && (
                    <p>Alternative reasonable cuts: {candidate.upgrade.alternatives.map((a) => `${a.cutName} (${signed(a.delta)})`).join(" · ")}</p>
                  )}
                </section>
              ) : (
                <p>No valid one-for-one cut keeps this deck's essential functions.</p>
              )}
              <label>
                Compare with a card in this deck
                <select value={against} onChange={(e) => setAgainst(e.target.value)}>
                  <option value="">Choose a deck card</option>
                  {rows.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              {chosenRow && chosenSwap && (
                <section aria-label="Chosen swap">
                  <h4>Swap for {chosenRow.name}</h4>
                  {"invalid" in chosenSwap ? (
                    <p>Not a valid swap: {chosenSwap.invalid}</p>
                  ) : (
                    <>
                      <p>
                        Upgrade Value for this swap: {signed(Math.round(chosenSwap.delta * 100) / 100)}
                      </p>
                      <SwapDeltas swap={chosenSwap} />
                    </>
                  )}
                </section>
              )}
              <p>Comparing makes no deck changes.</p>
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
            {results.slice(0, limit).map((c) => {
              const u = "upgrade" in c ? (c as UpgradeCandidate).upgrade : null;
              return (
                <li key={c.identity} data-fit={u ? u.label : c.build.priorityLabel}>
                  <button className="synergy-art deck-art-button" aria-label={`View ${c.card.name} details`} onClick={() => setDetail(c)}>
                    <CardImage card={c.card} />
                  </button>
                  <div>
                    <h3>
                      {c.card.name}{" "}
                      <span>
                        {u ? `${u.label} · ${signed(u.upgradeValue)}` : `Build Priority: ${c.build.priorityLabel} · ${c.build.buildPriority}`}
                      </span>
                    </h3>
                    <BuildSummary build={c.build} />
                    {u ? (
                      <UpgradeLines u={u} />
                    ) : (
                      <>
                        {c.build.priorityConcerns.length > 0 && (
                          <p className="upgrade-concern">
                            {c.build.buildPriority < c.build.commanderFit ? "Why priority is lower: " : "Concerns: "}
                            {c.build.priorityConcerns.join(" ")}
                          </p>
                        )}
                        {c.build.priorityReasons.length > 0 && <p>Impact: {c.build.priorityReasons.join(" ")}</p>}
                        <p>
                          {c.build.dependency}
                          {c.build.timing ? ` · ${c.build.timing}` : ""}
                        </p>
                      </>
                    )}
                    <p>Confidence: {u ? u.confidence : c.build.confidence}</p>
                    <Availability c={c} />
                    {u && (
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
                    )}
                    <Printings c={c} />
                    {trace && <Trace trace={u ? u.trace : c.build.trace} />}
                  </div>
                </li>
              );
            })}
          </ul>
          {results.length > limit && (
            <button className="primary-button" onClick={() => setLimit((n) => n + 40)}>
              Show more candidates
            </button>
          )}
        </>
      )}
    </Dialog>
  );
}
function UpgradeLines({ u }: { u: UpgradeEvaluation }) {
  return (
    <>
      <p className="upgrade-metric">Current Deck Upgrade: <strong>{u.label}</strong></p>
      {u.best && <p>Best swap: cut {u.best.cutName}</p>}
      {u.reasons.length > 0 && <p>Why: {u.reasons.join(" ")}</p>}
      {u.concerns.length > 0 && <p className="upgrade-concern">Concerns: {u.concerns.join(" ")}</p>}
      {u.alternatives.length > 0 && <p>Alternative cuts: {u.alternatives.map((a) => a.cutName).join(" · ")}</p>}
    </>
  );
}
