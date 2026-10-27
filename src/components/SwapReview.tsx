import { useMemo, useState } from "react";
import type { CollectionState } from "../models/collection";
import type { Deck } from "../models/deck";
import { compareSwap, currentDeckModel } from "../upgrades";
import type { UpgradeCandidate } from "../upgrades";
import type { SwapResult } from "../upgrades/upgrade";
import { COMPONENTS, componentLabels, upgradeLabel } from "../upgrades/upgrade";
import { Dialog } from "./Dialog";

const signed = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}`;
const impactWord = (d: number | undefined) =>
  d === undefined || Math.abs(d) < 0.5 ? "—" : d >= 3 ? "Better" : d > 0 ? "Slightly better" : d <= -3 ? "Worse" : "Slightly worse";
export function SwapDeltas({ swap }: { swap: SwapResult }) {
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
/**
 * Review Swap: shows one one-for-one swap evaluated by the existing engine (the best cut, an alternative or any deck card
 * via compareSwap) and the physical copy that would join the deck. Nothing is written until Confirm Swap.
 */
export function SwapReview({
  state,
  deck,
  candidate,
  busy,
  onConfirm,
  onClose,
}: {
  state: CollectionState;
  deck: Deck;
  candidate: UpgradeCandidate;
  busy: boolean;
  onConfirm: (swap: { incomingItemId: string; outgoingCardIdentity: string; outgoingName: string }) => void;
  onClose: () => void;
}) {
  const u = candidate.upgrade;
  const [cut, setCut] = useState(u.best?.cut || "");
  const [choosing, setChoosing] = useState(!u.best);
  const [search, setSearch] = useState("");
  const available = candidate.printings.filter((p) => (p.ownership?.quantityUnassigned || 0) > 0);
  const [copy, setCopy] = useState(available[0]?.id || "");
  const deckCards = useMemo(() => {
    const seen = new Set<string>();
    return currentDeckModel(state, deck)
      .cards.filter((c) => !c.commander && !seen.has(c.identity) && seen.add(c.identity))
      .sort((a, b) => a.name.localeCompare(b.name, "en"));
  }, [state, deck]);
  const suggested = [u.best, ...u.alternatives].filter((s): s is SwapResult => !!s);
  const swap = useMemo(() => {
    if (!cut) return null;
    const known = suggested.find((s) => s.cut === cut);
    return known || compareSwap(state, deck, candidate.canonical, cut);
  }, [cut, state, deck, candidate, suggested]);
  const valid = swap && !("invalid" in swap) ? swap : null;
  const outName = deckCards.find((c) => c.identity === cut)?.name || "";
  const value = valid ? Math.round(valid.delta * 100) / 100 : 0;
  let label = valid ? (valid.cut === u.best?.cut ? u.label : upgradeLabel(value)) : "";
  // The engine's low-confidence cap applies to any swap of this candidate, not only its best cut.
  if (u.confidence === "Low" && ["Major Upgrade", "Strong Upgrade", "Moderate Upgrade"].includes(label)) label = "Minor Upgrade";
  const others = deckCards.filter((c) => !suggested.some((s) => s.cut === c.identity) && c.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const copyCard = candidate.printings.find((p) => p.id === copy);
  return (
    <Dialog titleId="swap-review-title" className="deck-dialog swap-review" onClose={() => !busy && onClose()} closeDisabled={busy}>
      <div className="dialog-heading">
        <p className="eyebrow">REVIEW SWAP · {deck.name}</p>
        <h2 id="swap-review-title">Review Swap</h2>
      </div>
      <div className="deck-dialog-content">
        <div className="swap-sides">
          <section aria-label="Card going out">
            <p className="eyebrow">OUT</p>
            <p className="swap-name">{outName || "Choose a card"}</p>
          </section>
          <section aria-label="Card coming in">
            <p className="eyebrow">IN</p>
            <p className="swap-name">{candidate.card.name}</p>
          </section>
        </div>
        {swap && "invalid" in swap && <p className="deck-error">Not a valid swap: {swap.invalid}</p>}
        {valid && (
          <>
            <section aria-label="Expected deck impact">
              <h3>Expected Deck Impact</h3>
              <dl className="swap-impact">
                {COMPONENTS.map((c) => (
                  <div key={c}>
                    <dt>{componentLabels[c]}</dt>
                    <dd>{impactWord(valid.deltas[c])}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <p className="swap-value">
              Upgrade Value <strong>{signed(value)}</strong> · {label}
            </p>
            {u.confidence === "Low" && <p className="meta-text">Oracle parsing is incomplete for this card, so the claim is capped; review it manually.</p>}
            <details>
              <summary>Detailed Analysis</summary>
              <SwapDeltas swap={valid} />
            </details>
          </>
        )}
        <section aria-label="Physical copy">
          <h3>Physical Copy</h3>
          {available.length === 0 ? (
            <p className="deck-error">No available copy. Every owned copy is assigned to another deck; copies are never moved automatically.</p>
          ) : available.length === 1 ? (
            <p>
              {candidate.card.name} · {available[0].setCode.toUpperCase()} #{available[0].collectorNumber} · {available[0].ownership!.finish} · Available{" "}
              {available[0].ownership!.quantityUnassigned}
            </p>
          ) : (
            <label>
              Choose Copy
              <select value={copy} onChange={(e) => setCopy(e.target.value)}>
                {available.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.setCode.toUpperCase()} #{p.collectorNumber} · {p.ownership!.finish} · Available {p.ownership!.quantityUnassigned}
                  </option>
                ))}
              </select>
            </label>
          )}
        </section>
        {choosing && (
          <section aria-label="Choose a different cut" className="swap-cuts">
            <h3>Choose Different Cut</h3>
            {suggested.length > 0 && (
              <ul>
                {suggested.map((s) => (
                  <li key={s.cut}>
                    <button className={`management-button${s.cut === cut ? " selected" : ""}`} aria-pressed={s.cut === cut} onClick={() => setCut(s.cut)}>
                      {s.cutName} · {signed(Math.round(s.delta * 100) / 100)}
                      {s.cut === u.best?.cut ? " · best" : ""}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <label>
              Search this deck
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
            <label>
              Another card in this deck
              <select value={suggested.some((s) => s.cut === cut) ? "" : cut} onChange={(e) => e.target.value && setCut(e.target.value)}>
                <option value="">Choose a deck card</option>
                {others.map((c) => (
                  <option key={c.identity} value={c.identity}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </section>
        )}
        <div className="swap-actions">
          <button
            className="primary-button"
            disabled={busy || !valid || !copyCard}
            onClick={() => valid && copyCard && onConfirm({ incomingItemId: copyCard.id, outgoingCardIdentity: valid.cut, outgoingName: valid.cutName })}
          >
            Confirm Swap
          </button>
          {!choosing && (
            <button className="management-button" disabled={busy} onClick={() => setChoosing(true)}>
              Choose Different Cut
            </button>
          )}
          <button className="text-button" disabled={busy} onClick={onClose}>
            Cancel
          </button>
        </div>
        <p className="meta-text">Confirming changes this deck only: the outgoing copy returns to Available and one owned copy is assigned.</p>
        {busy && <p role="status">Saving swap…</p>}
      </div>
    </Dialog>
  );
}
