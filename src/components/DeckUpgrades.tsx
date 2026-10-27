import { useEffect, useMemo, useState } from "react";
import type { CollectionState } from "../models/collection";
import type { Deck, SavedDeckCandidate } from "../models/deck";
import { deckCount } from "../decks/decks";
import {
  MIN_CURRENT_DECK_CARDS,
  buildAroundCommander,
  buildFor,
  candidateGroups,
  commanderBlueprint,
  improveCurrentDeck,
  mainDeckCount,
  upgradeFor,
} from "../upgrades";
import type { BuildCandidate, UpgradeCandidate } from "../upgrades";
import type { OwnedCandidateGroup } from "../synergy/explorer";
import type { BuildEvaluation } from "../upgrades/build";
import type { UpgradeEvaluation } from "../upgrades/upgrade";
import type { DeckChange } from "../storage/deckRepository";
import { CardImage } from "./CardImage";
import { CardDetail } from "./CardDetail";
import { SwapDeltas, SwapReview } from "./SwapReview";

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
const availabilityLine = (c: OwnedCandidateGroup) =>
  c.available > 0 ? `Available ${c.available} · Owned ${c.owned}` : `Owned ${c.owned} · Available 0 · No available copy`;
/** The physical copy an action would use: the first available printing (printings list available copies first). */
const preferredCopy = (c: OwnedCandidateGroup) => c.printings.find((p) => (p.ownership?.quantityUnassigned || 0) > 0);
function Printings({ c }: { c: OwnedCandidateGroup }) {
  return (
    <details>
      <summary>
        {c.printings.length} owned {c.printings.length === 1 ? "printing / variant" : "printings / variants"}
      </summary>
      {c.printings.map((card) => (
        <p key={card.id} className="meta-text">
          {card.setCode.toUpperCase()} #{card.collectorNumber} · {card.ownership!.finish} · {card.ownership!.language} · {card.ownership!.binderName || "No binder"} ·
          Available {card.ownership!.quantityUnassigned} / Owned {card.quantity}
        </p>
      ))}
      {c.usage.length > 0 && <p className="meta-text">Used in: {c.usage.map((u) => `${u.name} (${u.quantity})`).join(" · ")}</p>}
    </details>
  );
}
function BuildWhy({ build }: { build: BuildEvaluation }) {
  return (
    <>
      <h4>Why it fits</h4>
      <ul>
        {build.fitReasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      {build.priorityReasons.length > 0 && (
        <>
          <h4>Build Priority</h4>
          <ul>
            {build.priorityReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </>
      )}
      {build.priorityConcerns.length > 0 && (
        <>
          <h4>{build.buildPriority < build.commanderFit ? "Why priority is lower" : "Concerns"}</h4>
          <ul>
            {build.priorityConcerns.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </>
      )}
      <p className="meta-text">
        {build.dependency}
        {build.timing ? ` · ${build.timing}` : ""} · Confidence: {build.confidence}
      </p>
    </>
  );
}
function ImproveWhy({ u, build }: { u: UpgradeEvaluation; build: BuildEvaluation }) {
  return (
    <>
      {u.reasons.length > 0 && (
        <>
          <h4>Why this helps</h4>
          <ul>
            {u.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </>
      )}
      {u.concerns.length > 0 && (
        <>
          <h4>Concerns</h4>
          <ul>
            {u.concerns.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </>
      )}
      {u.best && u.cutReasons.length > 0 && (
        <>
          <h4>Why cut {u.best.cutName}</h4>
          <ul>
            {u.cutReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </>
      )}
      {u.alternatives.length > 0 && <p className="meta-text">Alternative cuts: {u.alternatives.map((a) => `${a.cutName} (${signed(a.delta)})`).join(" · ")}</p>}
      <p className="meta-text">
        Commander Fit: {build.fitLabel} · {build.commanderFit} · Build Priority: {build.priorityLabel} · {build.buildPriority} · Confidence: {u.confidence}
      </p>
      {u.best && (
        <details>
          <summary>Detailed Analysis</summary>
          <SwapDeltas swap={u.best} />
        </details>
      )}
    </>
  );
}
/**
 * Upgrades: the two approved goals (Improve My Current Deck / Build Around My Commander) as a deck section, plus saved
 * candidates and the actions they lead to. Scores come unchanged from the v0.6.6 engine.
 */
export function DeckUpgrades({
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
  const count = mainDeckCount(deck);
  const canImprove = count >= MIN_CURRENT_DECK_CARDS;
  const complete = deckCount(deck) >= 100;
  const [view, setView] = useState<"recommended" | "saved">("recommended");
  const [mode, setMode] = useState<Mode>("");
  const [query, setQuery] = useState(""),
    [availability, setAvailability] = useState("all"),
    [sort, setSort] = useState("default"),
    [limit, setLimit] = useState(40),
    [reviewing, setReviewing] = useState<string | null>(null),
    [detail, setDetail] = useState<string | null>(null);
  // Analysis runs after the goal (or a saved change) renders, so large collections never freeze without feedback.
  const analysisKey = `${mode}:${state.revision}:${deck.modifiedAt}`;
  const [ready, setReady] = useState("");
  useEffect(() => {
    if (!mode) return;
    const id = setTimeout(() => setReady(analysisKey), 0);
    return () => clearTimeout(id);
  }, [mode, analysisKey]);
  const analyzing = !!mode && ready !== analysisKey;
  const trace = developerTrace();
  const blueprint = useMemo(() => commanderBlueprint(state, deck), [state, deck]);
  const build = useMemo(() => (mode === "build" && !analyzing ? buildAroundCommander(state, deck) : []), [mode, analyzing, state, deck]);
  const improve = useMemo(() => (mode === "improve" && !analyzing ? improveCurrentDeck(state, deck) : []), [mode, analyzing, state, deck]);
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
  const saved = deck.savedCandidates || [];
  const savedFor = (identity: string, intent: SavedDeckCandidate["intent"]) => saved.find((s) => s.candidateIdentity === identity && s.intent === intent);
  const groups = () => candidateGroups(state, deck);
  // Candidate objects for actions are rebuilt from current state so a saved card or detail always shows current scores.
  const upgradeCandidate = (identity: string): UpgradeCandidate | null => {
    const known = improve.find((c) => c.identity === identity);
    if (known) return known;
    const group = groups().find((g) => g.identity === identity);
    if (!group || !canImprove) return null;
    return { ...group, upgrade: upgradeFor(state, deck, group.canonical, identity), build: buildFor(state, deck, group.canonical) };
  };
  const saveToggle = (c: OwnedCandidateGroup, intent: SavedDeckCandidate["intent"], u?: UpgradeEvaluation) => {
    const existing = savedFor(c.identity, intent);
    if (existing) return change({ type: "remove-saved", deckId: deck.id, savedId: existing.id }, `${c.card.name} removed from Saved.`);
    return change(
      {
        type: "save-candidate",
        deckId: deck.id,
        candidate: {
          intent,
          candidateIdentity: c.identity,
          candidateName: c.card.name,
          ...(preferredCopy(c) ? { preferredItemId: preferredCopy(c)!.id } : {}),
          ...(u?.best ? { suggestedCutIdentity: u.best.cut, suggestedCutName: u.best.cutName } : {}),
        },
      },
      `${c.card.name} saved for this deck.`,
    );
  };
  const addToDeck = (c: OwnedCandidateGroup) => {
    const copy = preferredCopy(c);
    if (copy) void change({ type: "add", deckId: deck.id, itemId: copy.id }, `${c.card.name} added to ${deck.name}.`);
  };
  const evaluateAsUpgrade = (c: OwnedCandidateGroup) => {
    setView("recommended");
    setMode("improve");
    setQuery(c.card.name);
    setAvailability("all");
    setSort("default");
  };
  const buildAction = (c: OwnedCandidateGroup) =>
    complete ? (
      canImprove && (
        <button className="management-button" onClick={() => evaluateAsUpgrade(c)}>
          Evaluate as Upgrade
        </button>
      )
    ) : (
      <button className="primary-button" disabled={busy || c.available < 1} onClick={() => addToDeck(c)}>
        Add to Deck
      </button>
    );
  const review = reviewing ? upgradeCandidate(reviewing) : null;
  const detailGroup = detail ? groups().find((g) => g.identity === detail) : null;
  if (detailGroup) {
    const detailBuild = buildFor(state, deck, detailGroup.canonical);
    const upgrade = canImprove ? upgradeFor(state, deck, detailGroup.canonical, detailGroup.identity) : undefined;
    return (
      <CardDetail
        card={detailGroup.card}
        collection={state}
        onClose={() => setDetail(null)}
        extra={
          <section className="upgrade-scores" aria-label="Upgrades I Own scores">
            <h3>Upgrades I Own</h3>
            <dl>
              <div>
                <dt>Commander Fit</dt>
                <dd>
                  {detailBuild.fitLabel} — {detailBuild.commanderFit}
                  <small>Does it belong in this Commander's strategy?</small>
                </dd>
              </div>
              <div>
                <dt>Build Priority</dt>
                <dd>
                  {detailBuild.priorityLabel} — {detailBuild.buildPriority}
                  <small>Should I prioritize adding it while building from scratch?</small>
                </dd>
              </div>
              <div>
                <dt>Upgrade Value</dt>
                <dd>
                  {upgrade
                    ? `${upgrade.label} (${signed(upgrade.upgradeValue)})${upgrade.best ? ` · best swap: cut ${upgrade.best.cutName}` : ""}`
                    : `Needs at least ${MIN_CURRENT_DECK_CARDS} cards in the deck.`}
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
    <section className="deck-upgrades" aria-label="Upgrades">
      <div className="section-heading">
        <h2>Upgrades</h2>
        <div className="segmented" role="group" aria-label="Upgrades view">
          <button aria-pressed={view === "recommended"} className={view === "recommended" ? "active" : ""} onClick={() => setView("recommended")}>
            Recommended
          </button>
          <button aria-pressed={view === "saved"} className={view === "saved" ? "active" : ""} onClick={() => setView("saved")}>
            Saved{saved.length ? ` · ${saved.length}` : ""}
          </button>
        </div>
      </div>
      {view === "saved" ? (
        <SavedList
          state={state}
          deck={deck}
          busy={busy}
          canImprove={canImprove}
          complete={complete}
          change={change}
          onReview={setReviewing}
          onDetail={setDetail}
          buildAction={buildAction}
        />
      ) : !mode ? (
        <section className="upgrade-modes" aria-label="Choose a goal">
          <h3>What are you trying to do?</h3>
          <button className="upgrade-mode" disabled={!canImprove} onClick={() => setMode("improve")} aria-describedby="improve-help">
            <strong>Improve My Current Deck</strong>
            <span id="improve-help">
              Which cards I own actually improve this exact deck? Primary result: Upgrade Value from the best one-for-one swap.
              {!canImprove && ` This deck has ${count} of 99 cards; at least ${MIN_CURRENT_DECK_CARDS} are needed.`}
            </span>
          </button>
          <button className="upgrade-mode" onClick={() => setMode("build")} aria-describedby="build-help">
            <strong>Build Around My Commander</strong>
            <span id="build-help">
              Which cards I own belong in a deck centered around {blueprint.commanders.join(" + ")}? Primary results: Build Priority, then Commander Fit.
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
                setQuery("");
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
                <p className="meta-text">
                  Commander Fit asks whether a card belongs in this strategy. Build Priority asks how much you would want it when building from scratch.
                </p>
              </details>
            </section>
          ) : (
            <p className="meta-text">
              Upgrade Value simulates replacing each reasonable card in this deck with the candidate and keeps the best one-for-one swap. Nothing
              changes until you confirm a swap.
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
          <p role="status">{analyzing ? "Analyzing owned cards…" : `${results.length} ${results.length === 1 ? "candidate" : "candidates"}`}</p>
          {!analyzing && !results.length && <p className="prose">No owned candidates match. Try another search or import more of your collection.</p>}
          <ul className="synergy-candidates">
            {results.slice(0, limit).map((c) => {
              const u = "upgrade" in c ? (c as UpgradeCandidate).upgrade : null;
              const intent = u ? "improve" : "build";
              const isSaved = !!savedFor(c.identity, intent);
              return (
                <li key={c.identity} data-fit={u ? u.label : c.build.priorityLabel} className="upgrade-card">
                  <button className="synergy-art deck-art-button" aria-label={`View ${c.card.name} details`} onClick={() => setDetail(c.identity)}>
                    <CardImage card={c.card} />
                  </button>
                  <div>
                    <h3>{c.card.name}</h3>
                    {u ? (
                      <>
                        <p className="upgrade-headline">
                          <strong>{u.label}</strong> <span className="upgrade-number">{signed(u.upgradeValue)}</span>
                        </p>
                        <p className="upgrade-cut">{u.best ? `Best swap: cut ${u.best.cutName}` : "No valid one-for-one cut keeps this deck's essential functions."}</p>
                        {(u.reasons[0] || u.concerns[0]) && <p className="prose">{u.reasons.slice(0, 2).join(" ") || u.concerns[0]}</p>}
                      </>
                    ) : (
                      <>
                        <p className="upgrade-headline">
                          <span className="metric-name">Build Priority</span> <strong>{c.build.priorityLabel}</strong>{" "}
                          <span className="upgrade-number">{c.build.buildPriority}</span>
                        </p>
                        <p className="upgrade-secondary">
                          Commander Fit: {c.build.fitLabel} · {c.build.commanderFit}
                        </p>
                        {c.build.fitReasons[0] && <p className="prose">{c.build.fitReasons[0]}</p>}
                      </>
                    )}
                    <p className="meta-text">{availabilityLine(c)}</p>
                    <div className="upgrade-actions">
                      {u ? (
                        u.best && (
                          <button className="primary-button" disabled={busy} onClick={() => setReviewing(c.identity)}>
                            Review Swap
                          </button>
                        )
                      ) : (
                        buildAction(c)
                      )}
                      <button className="management-button" disabled={busy} aria-pressed={isSaved} onClick={() => void saveToggle(c, intent, u || undefined)}>
                        {isSaved ? "Saved" : u ? "Save Upgrade" : "Save Candidate"}
                      </button>
                    </div>
                    <details className="upgrade-why">
                      <summary>Why?</summary>
                      {u ? <ImproveWhy u={u} build={c.build} /> : <BuildWhy build={c.build} />}
                      <Printings c={c} />
                    </details>
                    <button className="text-button" onClick={() => setDetail(c.identity)}>
                      Card Details
                    </button>
                    {trace && (
                      <details className="developer-trace">
                        <summary>Developer trace</summary>
                        <pre>{JSON.stringify(u ? u.trace : c.build.trace, null, 2)}</pre>
                      </details>
                    )}
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
      {review && (
        <SwapReview
          state={state}
          deck={deck}
          candidate={review}
          busy={busy}
          onClose={() => setReviewing(null)}
          onConfirm={async ({ incomingItemId, outgoingCardIdentity, outgoingName }) => {
            const ok = await change(
              { type: "swap", deckId: deck.id, incomingItemId, outgoingCardIdentity },
              `${review.card.name} replaced ${outgoingName}.`,
            );
            if (ok) setReviewing(null);
          }}
        />
      )}
    </section>
  );
}

/** Saved candidates: identity and intent are stored; every score shown here is recalculated for the deck as it is now. */
function SavedList({
  state,
  deck,
  busy,
  canImprove,
  complete,
  change,
  onReview,
  onDetail,
  buildAction,
}: {
  state: CollectionState;
  deck: Deck;
  busy: boolean;
  canImprove: boolean;
  complete: boolean;
  change: (action: DeckChange, success: string) => Promise<boolean>;
  onReview: (identity: string) => void;
  onDetail: (identity: string) => void;
  buildAction: (c: OwnedCandidateGroup) => React.ReactNode;
}) {
  const saved = [...(deck.savedCandidates || [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.candidateName.localeCompare(b.candidateName, "en"));
  const groups = candidateGroups(state, deck);
  if (!saved.length)
    return (
      <p className="prose">
        Nothing saved yet. Use Save Upgrade or Save Candidate on a recommendation to keep it here; its scores are recalculated whenever you
        return.
      </p>
    );
  return (
    <section aria-label="Saved candidates">
      <h3>Saved · {saved.length}</h3>
      <ul className="synergy-candidates">
        {saved.map((s) => {
          const group = groups.find((g) => g.identity === s.candidateIdentity);
          const remove = (
            <button className="text-button" disabled={busy} onClick={() => void change({ type: "remove-saved", deckId: deck.id, savedId: s.id }, `${s.candidateName} removed from Saved.`)}>
              Remove {s.candidateName} from Saved
            </button>
          );
          if (!group)
            return (
              <li key={s.id} className="upgrade-card">
                <div>
                  <h3>{s.candidateName}</h3>
                  <p className="prose">Already in this deck, or no longer an owned legal card for it.</p>
                  {remove}
                </div>
              </li>
            );
          const upgrade = s.intent === "improve" && canImprove ? upgradeFor(state, deck, group.canonical, group.identity) : null;
          const build = buildFor(state, deck, group.canonical);
          return (
            <li key={s.id} className="upgrade-card" data-intent={s.intent}>
              <button className="synergy-art deck-art-button" aria-label={`View ${group.card.name} details`} onClick={() => onDetail(group.identity)}>
                <CardImage card={group.card} />
              </button>
              <div>
                <h3>{group.card.name}</h3>
                {s.intent === "improve" ? (
                  upgrade ? (
                    <>
                      <p className="upgrade-headline">
                        <strong>{upgrade.label}</strong> <span className="upgrade-number">{signed(upgrade.upgradeValue)}</span>
                      </p>
                      <p className="upgrade-cut">{upgrade.best ? `Suggested out: ${upgrade.best.cutName}` : "No valid one-for-one cut right now."}</p>
                      {s.suggestedCutName && upgrade.best && s.suggestedCutName !== upgrade.best.cutName && (
                        <p className="meta-text">When saved, the suggested cut was {s.suggestedCutName}.</p>
                      )}
                    </>
                  ) : (
                    <p className="prose">Upgrade Value needs at least {MIN_CURRENT_DECK_CARDS} cards in the deck.</p>
                  )
                ) : (
                  <>
                    <p className="upgrade-headline">
                      <span className="metric-name">Build Candidate</span> <strong>{build.priorityLabel}</strong>
                    </p>
                    <p className="upgrade-secondary">
                      Commander Fit {build.fitLabel} · {build.commanderFit}
                    </p>
                  </>
                )}
                <p className="meta-text">{availabilityLine(group)}</p>
                <div className="upgrade-actions">
                  {s.intent === "improve"
                    ? upgrade?.best && (
                        <button className="primary-button" disabled={busy} onClick={() => onReview(group.identity)}>
                          Review Swap
                        </button>
                      )
                    : buildAction(group)}
                  {remove}
                </div>
                <button className="text-button" onClick={() => onDetail(group.identity)}>
                  Card Details
                </button>
                {complete && s.intent === "build" && !canImprove && <p className="meta-text">This deck is full.</p>}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
